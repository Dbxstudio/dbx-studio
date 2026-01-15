import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { orpc, ORPCError } from '~/orpc'
import { db, connections } from '~/drizzle'
import { closeConnection } from '~/kysely/connections'

/**
 * Delete a connection
 */
export const remove = orpc
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
        const existing = await db.query.connections.findFirst({
            where: (table, { eq }) => eq(table.id, input.id),
        })

        if (!existing) {
            throw new ORPCError('NOT_FOUND', {
                message: `Connection with id ${input.id} not found`,
            })
        }

        // Close any active connection pools
        await closeConnection(input.id, existing.type)

        await db.delete(connections).where(eq(connections.id, input.id))

        return { success: true, id: input.id }
    })
