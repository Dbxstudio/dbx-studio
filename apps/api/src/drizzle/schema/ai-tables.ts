/**
 * AI Tables Schema - Drizzle ORM
 * Migrated from Sequelize SQLite to PGLite
 * Includes: Sessions, Conversations, Memory, Schema Metadata
 */

import { pgTable, text, timestamp, integer, boolean, real, serial } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { nanoid } from 'nanoid'
import { connections } from './connections'

const generateId = () => nanoid(21)

// ========== Database Type Reference Tables ==========

// Database types (PostgreSQL, MySQL, MSSQL, etc.)
export const dbTypes = pgTable('db_types', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(), // 'postgresql', 'mysql', 'mssql', 'clickhouse', etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Connection status types
export const connectionStatuses = pgTable('connection_statuses', {
    id: serial('id').primaryKey(),
    status: text('status').notNull().unique(), // 'active', 'inactive', 'error', etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ========== Database Metadata Tables ==========

// Active connections (for AI features - references main connections table)
export const activeConnections = pgTable('active_connections', {
    id: serial('id').primaryKey(),
    connectionId: text('connection_id').references(() => connections.id, { onDelete: 'cascade' }), // Link to main connections table
    connectionString: text('connection_string'),
    dbTypeId: integer('db_type_id').references(() => dbTypes.id),
    isSsl: boolean('is_ssl').default(false),
    statusId: integer('status_id').references(() => connectionStatuses.id),
    userId: text('user_id'),
    database: text('database'),
    externalConnectionId: text('external_connection_id'), // Server-side connection ID
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Databases
export const databases = pgTable('databases', {
    id: serial('id').primaryKey(),
    activeConnectionId: integer('active_connection_id').references(() => activeConnections.id, { onDelete: 'cascade' }).notNull(),
    databaseName: text('database_name').notNull(),
    schemaStatusId: integer('schema_status_id').default(1000), // Status tracking for schema sync
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Schemas (PostgreSQL schemas, MySQL databases, etc.)
export const schemas = pgTable('schemas', {
    id: serial('id').primaryKey(),
    databaseId: integer('database_id').references(() => databases.id, { onDelete: 'cascade' }).notNull(),
    schemaName: text('schema_name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Schema tables with AI descriptions
export const schemaTables = pgTable('schema_tables', {
    id: serial('id').primaryKey(),
    databaseId: integer('database_id').references(() => databases.id, { onDelete: 'cascade' }).notNull(),
    schemaId: integer('schema_id').references(() => schemas.id, { onDelete: 'cascade' }).notNull(),
    tableName: text('table_name').notNull(),
    aiDescription: text('ai_description'), // AI-generated table description
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Column descriptions with AI metadata
export const columnDescriptions = pgTable('column_descriptions', {
    id: serial('id').primaryKey(),
    tableId: integer('table_id').references(() => schemaTables.id, { onDelete: 'cascade' }).notNull(),
    columnName: text('column_name').notNull(),
    columnType: text('column_type'), // 'VARCHAR(255)', 'INTEGER', etc.
    aiDescription: text('ai_description'), // AI-generated column description
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ========== AI Chat & Memory Tables ==========

// Chat sessions
export const aiSessions = pgTable('ai_sessions', {
    id: text('id').primaryKey().$defaultFn(generateId),
    activeConnectionId: integer('active_connection_id').references(() => activeConnections.id, { onDelete: 'cascade' }),
    sessionName: text('session_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastActivity: timestamp('last_activity').defaultNow().notNull(),
})

// Conversation history (short-term memory)
export const aiConversations = pgTable('ai_conversations', {
    id: text('id').primaryKey().$defaultFn(generateId),
    sessionId: text('session_id').references(() => aiSessions.id, { onDelete: 'cascade' }).notNull(),
    databaseId: integer('database_id').references(() => databases.id, { onDelete: 'set null' }),
    schemaId: integer('schema_id').references(() => schemas.id, { onDelete: 'set null' }),
    messages: text('messages'), // JSON string of message array
    timestamp: timestamp('timestamp').defaultNow().notNull(),
})

// Long-term memory with embeddings
export const aiLongTermMemories = pgTable('ai_long_term_memories', {
    id: text('id').primaryKey().$defaultFn(generateId),
    conversationId: text('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }).notNull(),
    databaseId: integer('database_id').references(() => databases.id, { onDelete: 'set null' }),
    schemaId: integer('schema_id').references(() => schemas.id, { onDelete: 'set null' }),
    scopeLevel: text('scope_level').notNull().default('global'), // 'global', 'database', 'schema', 'table'
    content: text('content').notNull(), // The memory content/fact
    embedding: text('embedding'), // JSON string of embedding vector
    memoryType: text('memory_type').notNull().default('extracted'), // 'extracted', 'preference', 'pattern'
    importanceScore: real('importance_score').notNull().default(1.0),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessed: timestamp('last_accessed'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ========== Zod Schemas ==========

export const dbTypeInsertSchema = createInsertSchema(dbTypes)
export const dbTypeSelectSchema = createSelectSchema(dbTypes)

export const connectionStatusInsertSchema = createInsertSchema(connectionStatuses)
export const connectionStatusSelectSchema = createSelectSchema(connectionStatuses)

export const activeConnectionInsertSchema = createInsertSchema(activeConnections)
export const activeConnectionSelectSchema = createSelectSchema(activeConnections)

export const databaseInsertSchema = createInsertSchema(databases)
export const databaseSelectSchema = createSelectSchema(databases)

export const schemaInsertSchema = createInsertSchema(schemas)
export const schemaSelectSchema = createSelectSchema(schemas)

export const schemaTableInsertSchema = createInsertSchema(schemaTables)
export const schemaTableSelectSchema = createSelectSchema(schemaTables)

export const columnDescriptionInsertSchema = createInsertSchema(columnDescriptions)
export const columnDescriptionSelectSchema = createSelectSchema(columnDescriptions)

export const aiSessionInsertSchema = createInsertSchema(aiSessions)
export const aiSessionSelectSchema = createSelectSchema(aiSessions)

export const aiConversationInsertSchema = createInsertSchema(aiConversations)
export const aiConversationSelectSchema = createSelectSchema(aiConversations)

export const aiLongTermMemoryInsertSchema = createInsertSchema(aiLongTermMemories)
export const aiLongTermMemorySelectSchema = createSelectSchema(aiLongTermMemories)

// ========== Type Exports ==========

export type DbType = typeof dbTypes.$inferSelect
export type NewDbType = typeof dbTypes.$inferInsert

export type ConnectionStatus = typeof connectionStatuses.$inferSelect
export type NewConnectionStatus = typeof connectionStatuses.$inferInsert

export type ActiveConnection = typeof activeConnections.$inferSelect
export type NewActiveConnection = typeof activeConnections.$inferInsert

export type Database = typeof databases.$inferSelect
export type NewDatabase = typeof databases.$inferInsert

export type Schema = typeof schemas.$inferSelect
export type NewSchema = typeof schemas.$inferInsert

export type SchemaTable = typeof schemaTables.$inferSelect
export type NewSchemaTable = typeof schemaTables.$inferInsert

export type ColumnDescription = typeof columnDescriptions.$inferSelect
export type NewColumnDescription = typeof columnDescriptions.$inferInsert

export type AISession = typeof aiSessions.$inferSelect
export type NewAISession = typeof aiSessions.$inferInsert

export type AIConversation = typeof aiConversations.$inferSelect
export type NewAIConversation = typeof aiConversations.$inferInsert

export type AILongTermMemory = typeof aiLongTermMemories.$inferSelect
export type NewAILongTermMemory = typeof aiLongTermMemories.$inferInsert
