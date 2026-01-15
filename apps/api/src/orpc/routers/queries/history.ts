import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { orpc, ORPCError } from '~/orpc'
import { db, queries } from '~/drizzle'

/**
 * List query history
 */
export const list = orpc
    .input(z.object({
        connectionId: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        favoritesOnly: z.boolean().optional().default(false),
    }))
    .handler(async ({ input }) => {
        let query = db
            .select()
            .from(queries)
            .orderBy(desc(queries.executedAt))
            .limit(input.limit)
            .offset(input.offset)

        // Note: Filtering would need to be done with where clauses
        // This is simplified for now
        const results = await query

        return results
    })

/**
 * Toggle favorite status
 */
export const toggleFavorite = orpc
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
        const existing = await db.query.queries.findFirst({
            where: (table, { eq }) => eq(table.id, input.id),
        })

        if (!existing) {
            throw new ORPCError('NOT_FOUND', {
                message: `Query with id ${input.id} not found`,
            })
        }

        const [updated] = await db
            .update(queries)
            .set({ isFavorite: !existing.isFavorite })
            .where(eq(queries.id, input.id))
            .returning()

        return updated
    })

/**
 * Delete a query from history
 */
export const remove = orpc
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
        await db.delete(queries).where(eq(queries.id, input.id))
        return { success: true, id: input.id }
    })
