import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { nanoid } from 'nanoid'
import { connections } from './connections'

const generateId = () => nanoid(21)

// Query history - stores executed queries
export const queries = pgTable('queries', {
    id: text('id').primaryKey().$defaultFn(generateId),
    connectionId: text('connection_id').references(() => connections.id, { onDelete: 'cascade' }),

    // Query details
    sql: text('sql').notNull(),
    database: text('database'),
    schema: text('schema'),

    // Execution info
    executedAt: timestamp('executed_at').defaultNow().notNull(),
    duration: text('duration'), // execution time in ms
    rowCount: text('row_count'),
    error: text('error'),
    isSuccess: boolean('is_success').default(true),

    // Metadata
    title: text('title'),
    isFavorite: boolean('is_favorite').default(false),
    tags: jsonb('tags').$type<string[]>(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Zod schemas
export const queryInsertSchema = createInsertSchema(queries)
export const querySelectSchema = createSelectSchema(queries)

// Type exports
export type Query = typeof queries.$inferSelect
export type NewQuery = typeof queries.$inferInsert
