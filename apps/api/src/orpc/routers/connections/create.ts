import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db, connections } from '~/drizzle'

const createConnectionSchema = z.object({
    name: z.string().min(1, 'Connection name is required'),
    type: z.enum(['postgresql', 'mysql', 'mssql', 'clickhouse', 'snowflake']),
    userId: z.string().optional(), // Owner of this connection
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional().default(false),
    sslCa: z.string().optional(),
    sslCert: z.string().optional(),
    sslKey: z.string().optional(),
    account: z.string().optional(),
    warehouse: z.string().optional(),
    role: z.string().optional(),
    protocol: z.string().optional(),
    connectionString: z.string().optional(),
    label: z.string().optional(),
    color: z.string().optional(),
})

/**
 * Create a new connection
 */
export const create = orpc
    .input(createConnectionSchema)
    .handler(async ({ input }) => {
        try {
            const [connection] = await db
                .insert(connections)
                .values({
                    ...input,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning()

            if (!connection) {
                throw new ORPCError('INTERNAL_SERVER_ERROR', {
                    message: 'Failed to create connection',
                })
            }

            // Return connection without password
            const { password, ...safeConnection } = connection
            return safeConnection
        } catch (error) {
            console.error('❌ [Create Connection] Error:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to create connection',
            })
        }
    })
