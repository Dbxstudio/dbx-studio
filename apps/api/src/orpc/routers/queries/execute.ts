import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db, queries } from '~/drizzle'
import {
    createPostgresConnection,
    createMysqlConnection,
    createMssqlConnection,
    createClickHouseConnection
} from '~/kysely/connections'
import { sql } from 'kysely'

const executeQuerySchema = z.object({
    connectionId: z.string(),
    sql: z.string(),
    saveToHistory: z.boolean().optional().default(true),
    title: z.string().optional(),
})

/**
 * Execute a raw SQL query
 */
export const execute = orpc
    .input(executeQuerySchema)
    .handler(async ({ input }) => {
        const connection = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.connectionId),
        })

        if (!connection) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.connectionId} not found`,
            })
        }

        const startTime = Date.now()
        let rows: unknown[] = []
        let error: string | undefined
        let isSuccess = true

        try {
            switch (connection.type) {
                case 'postgresql': {
                    const kysely = createPostgresConnection(connection)
                    const result = await sql.raw(input.sql).execute(kysely)
                    rows = result.rows as unknown[]
                    break
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const result = await sql.raw(input.sql).execute(kysely)
                    rows = result.rows as unknown[]
                    break
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)
                    const result = await pool.query(input.sql)
                    rows = result.recordset || []
                    break
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)
                    const result = await client.query({
                        query: input.sql,
                        format: 'JSONEachRow',
                    })
                    rows = await result.json()
                    break
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Query execution not implemented for ${connection.type}`,
                    })
            }
        } catch (e) {
            isSuccess = false
            error = e instanceof Error ? e.message : 'Query execution failed'
        }

        const duration = Date.now() - startTime

        // Save to query history
        if (input.saveToHistory) {
            await db.insert(queries).values({
                connectionId: input.connectionId,
                sql: input.sql,
                database: connection.database || undefined,
                duration: duration.toString(),
                rowCount: rows.length.toString(),
                error,
                isSuccess,
                title: input.title,
            })
        }

        if (!isSuccess) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error || 'Query execution failed',
            })
        }

        return {
            success: true,
            rows,
            rowCount: rows.length,
            duration,
        }
    })
