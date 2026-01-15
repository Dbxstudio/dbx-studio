import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { nanoid } from 'nanoid'

const generateId = () => nanoid(21)

// Settings table - stores app settings and preferences
export const settings = pgTable('settings', {
    id: text('id').primaryKey().$defaultFn(generateId),
    key: text('key').notNull().unique(),
    value: jsonb('value'),
    category: text('category'), // 'appearance', 'editor', 'ai', etc.
    description: text('description'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Zod schemas
export const settingsInsertSchema = createInsertSchema(settings)
export const settingsSelectSchema = createSelectSchema(settings)

// Type exports
export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
