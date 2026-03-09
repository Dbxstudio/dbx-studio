import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { sql } from 'kysely'
import { orpc, ORPCError } from '~/orpc'
import { db, connections } from '~/drizzle'
import {
    createPostgresConnection,
    createTempPostgresConnection,
    createMysqlConnection,
    createTempMysqlConnection,
    createMssqlConnection,
    createClickHouseConnection,
    createSnowflakeConnection,
    executeSnowflakeQuery,
    createTempSnowflakeConnection,
    createSupabaseConnection,
    createTempSupabaseConnection,
} from '~/kysely/connections'

const testConnectionSchema = z.object({
    id: z.string().optional(),
    // Allow testing with connection details directly
    type: z.enum(['postgresql', 'mysql', 'mssql', 'clickhouse', 'snowflake', 'supabase']).optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional(),
    connectionString: z.string().optional(),
    account: z.string().optional(),
    warehouse: z.string().optional(),
    role: z.string().optional(),
    protocol: z.string().optional(),
})

/**
 * Test a database connection
 */
export const test = orpc
    .input(testConnectionSchema)
    .handler(async ({ input }) => {
        const startTime = Date.now()

        let connectionConfig: typeof input
        let isExistingConnection = false

        // If id is provided, fetch connection from database
        if (input.id) {
            isExistingConnection = true
            const connection = await db.query.connections.findFirst({
                where: (table, { eq }) => eq(table.id, input.id!),
            })

            if (!connection) {
                throw new ORPCError('NOT_FOUND', {
                    message: `Connection with id ${input.id} not found`,
                })
            }

            connectionConfig = connection
        } else if (input.type) {
            connectionConfig = input
        } else {
            throw new ORPCError('BAD_REQUEST', {
                message: 'Either id or connection type must be provided',
            })
        }

        try {
            switch (connectionConfig.type) {
                case 'postgresql': {
                    if (isExistingConnection) {
                        // Use cached connection, don't destroy it
                        const kysely = createPostgresConnection(connectionConfig as any)
                        await sql`SELECT 1 as test`.execute(kysely)
                        // DON'T call kysely.destroy() - pool is cached
                    } else {
                        // Create temporary connection for testing, then destroy
                        const { kysely, pool } = createTempPostgresConnection(connectionConfig)
                        try {
                            await sql`SELECT 1 as test`.execute(kysely)
                        } finally {
                            await pool.end()
                        }
                    }
                    break
                }

                case 'mysql': {
                    if (isExistingConnection) {
                        const kysely = createMysqlConnection(connectionConfig as any)
                        await sql`SELECT 1 as test`.execute(kysely)
                        // DON'T call kysely.destroy() - pool is cached
                    } else {
                        const { kysely, pool } = createTempMysqlConnection(connectionConfig)
                        try {
                            await sql`SELECT 1 as test`.execute(kysely)
                        } finally {
                            await pool.promise().end()
                        }
                    }
                    break
                }

                case 'mssql': {
                    const pool = await createMssqlConnection(connectionConfig as any)
                    await pool.query('SELECT 1 as test')
                    // DON'T close - pool is cached
                    break
                }

                case 'clickhouse': {
                    const client = createClickHouseConnection(connectionConfig as any)
                    await client.query({
                        query: 'SELECT 1',
                        format: 'JSONEachRow',
                    })
                    // DON'T close - client is cached
                    break
                }

                case 'snowflake': {
                    if (isExistingConnection) {
                        const client = createSnowflakeConnection(connectionConfig as any)
                        await executeSnowflakeQuery(client, 'SELECT 1 AS test')
                    } else {
                        const client = createTempSnowflakeConnection(connectionConfig)
                        try {
                            await executeSnowflakeQuery(client, 'SELECT 1 AS test')
                        } finally {
                            if ((client as any).isUp()) {
                                await new Promise<void>((resolve) => {
                                    (client as any).destroy(() => resolve())
                                })
                            }
                        }
                    }
                    break
                }

                case 'supabase': {
                    if (isExistingConnection) {
                        const kysely = createSupabaseConnection(connectionConfig as any)
                        await sql`SELECT 1 as test`.execute(kysely)
                    } else {
                        const { kysely, pool } = createTempSupabaseConnection(connectionConfig)
                        try {
                            await sql`SELECT 1 as test`.execute(kysely)
                        } finally {
                            await pool.end()
                        }
                    }
                    break
                }

                default:
                    throw new ORPCError('BAD_REQUEST', {
                        message: `Unsupported database type: ${connectionConfig.type}`,
                    })
            }

            const latency = Date.now() - startTime

            // Update last connected timestamp if testing existing connection
            if (input.id) {
                await db
                    .update(connections)
                    .set({
                        lastConnectedAt: new Date(),
                        isActive: true,
                    })
                    .where(eq(connections.id, input.id))
            }

            return {
                success: true,
                message: 'Connection successful',
                latency,
                type: connectionConfig.type,
            }
        } catch (error) {
            const latency = Date.now() - startTime

            // Mark connection as inactive if testing existing connection
            if (input.id) {
                await db
                    .update(connections)
                    .set({ isActive: false })
                    .where(eq(connections.id, input.id))
            }

            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Connection failed',
                cause: { latency },
            })
        }
    })
