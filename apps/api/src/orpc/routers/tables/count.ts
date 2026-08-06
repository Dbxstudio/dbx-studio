import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import {
    createPostgresConnection,
    createMysqlConnection,
    createMssqlConnection,
    createClickHouseConnection,
    createRedshiftConnection,
    createSqliteConnection,
} from '~/kysely/connections'
import { bigQueryQuery, createBigQueryConnection, resolveBigQueryConfig } from '~/kysely/bigquery'
import { sql } from 'kysely'

function quoteBigQueryIdentifier(identifier: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
        throw new ORPCError('BAD_REQUEST', {
            message: `Invalid BigQuery identifier: ${identifier}`,
        })
    }
    return `\`${identifier}\``
}

const getCountSchema = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    schema: z.string().optional().default('public'),
})

/**
 * Get table row count (fast, no data fetch)
 */
export const count = orpc
    .input(getCountSchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`

                    const countResult = await sql<{ count: string }>`
                        SELECT COUNT(*) as count FROM ${sql.raw(fullTableName)}
                    `.execute(kysely)
                    const total = parseInt(countResult.rows[0]?.count || '0', 10)

                    return { count: total }
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = input.schema === 'public'
                        ? connection.database || 'mysql'
                        : input.schema
                    const fullTableName = `\`${database}\`.\`${input.tableName}\``

                    const countResult = await sql<{ count: number }>`
                        SELECT COUNT(*) as count FROM ${sql.raw(fullTableName)}
                    `.execute(kysely)
                    const total = countResult.rows[0]?.count || 0

                    return { count: total }
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)

                    const countResult = await pool.query<{ count: number }>`
                        SELECT COUNT(*) as count FROM [${input.schema}].[${input.tableName}]
                    `
                    const total = countResult.recordset[0]?.count || 0

                    return { count: total }
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)

                    const countResult = await client.query({
                        query: `SELECT COUNT(*) as count FROM ${connection.database || 'default'}.${input.tableName}`,
                        format: 'JSONEachRow',
                    })
                    const countRows = await countResult.json() as any[]
                    const total = parseInt(countRows[0]?.count || '0', 10)

                    return { count: total }
                }

                case 'redshift': {
                    const kysely = createRedshiftConnection(connection)
                    const fullTableName = `"${input.schema}"."${input.tableName}"`

                    const countResult = await sql<{ count: string }>`
                        SELECT COUNT(*) as count FROM ${sql.raw(fullTableName)}
                    `.execute(kysely)
                    const total = parseInt(countResult.rows[0]?.count || '0', 10)

                    return { count: total }
                }

                case 'sqlite': {
                    const kysely = createSqliteConnection(connection)
                    const fullTableName = `"${input.tableName}"`

                    const countResult = await sql<{ count: number }>`
                        SELECT COUNT(*) as count FROM ${sql.raw(fullTableName)}
                    `.execute(kysely)
                    const total = Number(countResult.rows[0]?.count || 0)

                    return { count: total }
                }

                case 'bigquery': {
                    const bqConfig = resolveBigQueryConfig(connection)
                    if (!bqConfig) {
                        throw new ORPCError('BAD_REQUEST', {
                            message: 'BigQuery connection requires projectId and keyFilename',
                        })
                    }

                    const dataset = input.schema === 'public'
                        ? (connection.dataset || '')
                        : input.schema

                    if (!dataset) {
                        throw new ORPCError('BAD_REQUEST', {
                            message: 'BigQuery dataset is required. Set dataset on the connection or choose a schema.',
                        })
                    }

                    const client = createBigQueryConnection({
                        connectionId: connection.id,
                        projectId: bqConfig.projectId,
                        keyFilename: bqConfig.keyFilename,
                        dataset: bqConfig.dataset,
                    })

                    const quotedTable = `${quoteBigQueryIdentifier(bqConfig.projectId)}.${quoteBigQueryIdentifier(dataset)}.${quoteBigQueryIdentifier(input.tableName)}`
                    const countRows = await bigQueryQuery(
                        client,
                        `SELECT COUNT(*) AS count FROM ${quotedTable}`,
                        dataset,
                    )
                    const total = Number((countRows[0] as any)?.count || 0)

                    return { count: total }
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Count not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to fetch count',
            })
        }
    })
