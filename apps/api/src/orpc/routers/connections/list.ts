import { z } from 'zod'
import { eq, desc, and, isNull, or } from 'drizzle-orm'
import { orpc, ORPCError } from '~/orpc'
import { db, connections, connectionInsertSchema } from '~/drizzle'

const listInputSchema = z.object({
    userId: z.string().optional(),
}).optional()

/**
 * List all connections for a user
 * If userId is provided, filters connections by that user
 * Also includes connections without a user_id (global/shared connections)
 */
export const list = orpc
    .input(listInputSchema)
    .handler(async ({ input }) => {
        let query = db
            .select({
                id: connections.id,
                name: connections.name,
                type: connections.type,
                userId: connections.userId,
                host: connections.host,
                port: connections.port,
                database: connections.database,
                username: connections.username,
                ssl: connections.ssl,
                account: connections.account,
                warehouse: connections.warehouse,
                role: connections.role,
                label: connections.label,
                color: connections.color,
                externalConnectionId: connections.externalConnectionId,
                lastConnectedAt: connections.lastConnectedAt,
                isActive: connections.isActive,
                createdAt: connections.createdAt,
                updatedAt: connections.updatedAt,
            })
            .from(connections)

        // If userId is provided, filter by user (or null user_id for shared connections)
        if (input?.userId) {
            query = query.where(
                or(
                    eq(connections.userId, input.userId),
                    isNull(connections.userId)
                )
            ) as typeof query
        }

        const allConnections = await query.orderBy(desc(connections.createdAt))

        // Never return passwords
        return allConnections
    })

