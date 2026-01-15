import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { orpc, ORPCError } from '~/orpc'
import { db, connections } from '~/drizzle'
import { closeConnection } from '~/kysely/connections'

const updateConnectionSchema = z.object({
    id: z.string(),
    name: z.string().min(1).optional(),
    type: z.enum(['postgresql', 'mysql', 'mssql', 'clickhouse', 'snowflake']).optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional(),
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
    externalConnectionId: z.string().optional(), // Server-side connection ID for AI features
    isActive: z.boolean().optional(),
})

/**
 * Update an existing connection
 */
export const update = orpc
    .input(updateConnectionSchema)
    .handler(async ({ input }) => {
        const { id, ...updateData } = input

        // Check if connection exists
        const existing = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, id),
        })

        if (!existing) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${id} not found`,
            })
        }

        // Close the cached connection pool so the next query creates a new pool
        // with the updated settings (host, database, etc.)
        await closeConnection(id, existing.type)

        const [updated] = await db
            .update(connections)
            .set({
                ...updateData,
                updatedAt: new Date(),
            })
            .where(eq(connections.id, id))
            .returning()

        if (!updated) {
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: 'Failed to update connection',
            })
        }

        // Return connection without password
        const { password, ...safeConnection } = updated
        return safeConnection
    })

