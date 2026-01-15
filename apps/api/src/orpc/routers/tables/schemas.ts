import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import {
    createPostgresConnection,
    createMysqlConnection,
    createMssqlConnection,
    createClickHouseConnection
} from '~/kysely/connections'
import { sql } from 'kysely'

const listSchemasSchema = z.object({
    connectionId: z.string(),
})

/**
 * List all schemas in a database
 */
export const schemas = orpc
    .input(listSchemasSchema)
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
                    const result = await sql<{ schema_name: string }>`
                        SELECT schema_name
                        FROM information_schema.schemata
                        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                        ORDER BY schema_name
                    `.execute(kysely)

                    return result.rows.map(row => ({
                        name: row.schema_name,
                        tables: [], // Tables will be fetched separately
                    }))
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const result = await sql<{ TABLE_SCHEMA: string }>`
                        SELECT DISTINCT TABLE_SCHEMA
                        FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
                        ORDER BY TABLE_SCHEMA
                    `.execute(kysely)

                    return result.rows.map(row => ({
                        name: row.TABLE_SCHEMA,
                        tables: [],
                    }))
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)
                    const result = await pool.query(`
                        SELECT name AS schema_name
                        FROM sys.schemas
                        WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner', 'db_accessadmin',
                                          'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader',
                                          'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
                        ORDER BY name
                    `)

                    return result.recordset.map((row: any) => ({
                        name: row.schema_name,
                        tables: [],
                    }))
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)
                    const result = await client.query({
                        query: `
                            SELECT DISTINCT database AS schema_name
                            FROM system.tables
                            WHERE database NOT IN ('system', 'INFORMATION_SCHEMA')
                            ORDER BY database
                        `,
                        format: 'JSONEachRow',
                    })
                    const schemas = await result.json() as Array<{ schema_name: string }>

                    return schemas.map(row => ({
                        name: row.schema_name,
                        tables: [],
                    }))
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Schema listing not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to fetch schemas',
            })
        }
    })
