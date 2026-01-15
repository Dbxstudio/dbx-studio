import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { nanoid } from 'nanoid'

// Database type enum values
export const databaseTypes = ['postgresql', 'mysql', 'mssql', 'clickhouse', 'snowflake'] as const
export type DatabaseType = typeof databaseTypes[number]

// Base ID generator
const generateId = () => nanoid(21)

// Connections table - stores database connection configurations
export const connections = pgTable('connections', {
    id: text('id').primaryKey().$defaultFn(generateId),
    name: text('name').notNull(),
    type: text('type', { enum: databaseTypes }).notNull(),

    // User ownership - connections are scoped to a user
    userId: text('user_id'),

    // Connection details
    host: text('host'),
    port: integer('port'),
    database: text('database'),
    username: text('username'),
    password: text('password'), // In production, this should be encrypted

    // SSL configuration
    ssl: boolean('ssl').default(false),
    sslCa: text('ssl_ca'),
    sslCert: text('ssl_cert'),
    sslKey: text('ssl_key'),

    // Snowflake specific
    account: text('account'),
    warehouse: text('warehouse'),
    role: text('role'),

    // ClickHouse specific
    protocol: text('protocol'), // http or https

    // Connection string (alternative to individual fields)
    connectionString: text('connection_string'),

    // Metadata
    label: text('label'),
    color: text('color'),
    externalConnectionId: text('external_connection_id'), // Server-side connection ID for AI features
    lastConnectedAt: timestamp('last_connected_at'),
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Zod schemas for validation
export const connectionInsertSchema = createInsertSchema(connections, {
    name: (schema) => schema.name.min(1, 'Connection name is required'),
    type: (schema) => schema.type,
})

export const connectionSelectSchema = createSelectSchema(connections)

// Type exports
export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert
