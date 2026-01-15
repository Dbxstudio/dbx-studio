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

const listTablesSchema = z.object({
    connectionId: z.string(),
    schema: z.string().optional().default('public'),
})

/**
 * List all tables in a database
 */
export const list = orpc
    .input(listTablesSchema)
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
                    const result = await sql<{ table_name: string; table_type: string }>`
                        SELECT table_name, table_type 
                        FROM information_schema.tables 
                        WHERE table_schema = ${input.schema}
                        AND table_type IN ('BASE TABLE', 'VIEW')
                        ORDER BY table_name
                    `.execute(kysely)
                    return result.rows.map(row => ({
                        name: row.table_name,
                        type: row.table_type === 'VIEW' ? 'view' : 'table',
                    }))
                }

                case 'mysql': {
                    const kysely = createMysqlConnection(connection)
                    const database = connection.database || 'mysql'
                    const result = await sql<{ TABLE_NAME: string; TABLE_TYPE: string }>`
                        SELECT TABLE_NAME, TABLE_TYPE 
                        FROM information_schema.TABLES 
                        WHERE TABLE_SCHEMA = ${database}
                        ORDER BY TABLE_NAME
                    `.execute(kysely)
                    return result.rows.map(row => ({
                        name: row.TABLE_NAME,
                        type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
                    }))
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connection)
                    const result = await pool.query<{ TABLE_NAME: string; TABLE_TYPE: string }>`
                        SELECT TABLE_NAME, TABLE_TYPE 
                        FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA = @schema
                        ORDER BY TABLE_NAME
                    `
                    return (result.recordset || []).map(row => ({
                        name: row.TABLE_NAME,
                        type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
                    }))
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connection)
                    const result = await client.query({
                        query: `
                            SELECT name, engine 
                            FROM system.tables 
                            WHERE database = {database:String}
                            ORDER BY name
                        `,
                        query_params: { database: connection.database || 'default' },
                        format: 'JSONEachRow',
                    })
                    const rows = await result.json<{ name: string; engine: string }[]>()
                    return rows.map(row => ({
                        name: row.name,
                        type: row.engine.includes('View') ? 'view' : 'table',
                    }))
                }

                default:
                    throw new ORPCError('NOT_IMPLEMENTED', {
                        message: `Table listing not implemented for ${connection.type}`,
                    })
            }
        } catch (error) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to list tables',
            })
        }
    })
