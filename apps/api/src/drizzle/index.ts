import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as connections from './schema/connections'
import * as queries from './schema/queries'
import * as settings from './schema/settings'
import * as aiTables from './schema/ai-tables'

// Re-export all schemas
export * from './schema/connections'
export * from './schema/queries'
export * from './schema/settings'
export * from './schema/ai-tables'

// Create PGlite instance
// In serverless environments (Vercel), use in-memory database
// In local development, use file-based storage for persistence
const pglite = new PGlite(
    process.env.VERCEL ? 'memory://' : './data/dbx.db'
)

// Create Drizzle instance with all schemas
export const db = drizzle(pglite, {
    schema: {
        ...connections,
        ...queries,
        ...settings,
        ...aiTables,
    },
    logger: process.env.NODE_ENV === 'development',
})

// Initialize database (create tables if they don't exist)
export async function initializeDatabase() {
    // Wait for PGlite to be ready
    await pglite.waitReady

    // Run initial SQL to create all tables
    await pglite.exec(`
        -- Main tables
        CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            user_id TEXT,
            host TEXT,
            port INTEGER,
            database TEXT,
            username TEXT,
            password TEXT,
            ssl BOOLEAN DEFAULT FALSE,
            ssl_ca TEXT,
            ssl_cert TEXT,
            ssl_key TEXT,
            account TEXT,
            warehouse TEXT,
            role TEXT,
            protocol TEXT,
            connection_string TEXT,
            label TEXT,
            color TEXT,
            external_connection_id TEXT,
            last_connected_at TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS queries (
            id TEXT PRIMARY KEY,
            connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
            sql TEXT NOT NULL,
            database TEXT,
            schema TEXT,
            executed_at TIMESTAMP DEFAULT NOW() NOT NULL,
            duration TEXT,
            row_count TEXT,
            error TEXT,
            is_success BOOLEAN DEFAULT TRUE,
            title TEXT,
            is_favorite BOOLEAN DEFAULT FALSE,
            tags JSONB,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value JSONB,
            category TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- AI Reference tables
        CREATE TABLE IF NOT EXISTS db_types (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS connection_statuses (
            id SERIAL PRIMARY KEY,
            status TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- AI Active connections
        CREATE TABLE IF NOT EXISTS active_connections (
            id SERIAL PRIMARY KEY,
            connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
            connection_string TEXT,
            db_type_id INTEGER REFERENCES db_types(id),
            is_ssl BOOLEAN DEFAULT FALSE,
            status_id INTEGER REFERENCES connection_statuses(id),
            user_id TEXT,
            database TEXT,
            external_connection_id TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Database metadata
        CREATE TABLE IF NOT EXISTS databases (
            id SERIAL PRIMARY KEY,
            active_connection_id INTEGER REFERENCES active_connections(id) ON DELETE CASCADE NOT NULL,
            database_name TEXT NOT NULL,
            schema_status_id INTEGER DEFAULT 1000,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schemas (
            id SERIAL PRIMARY KEY,
            database_id INTEGER REFERENCES databases(id) ON DELETE CASCADE NOT NULL,
            schema_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schema_tables (
            id SERIAL PRIMARY KEY,
            database_id INTEGER REFERENCES databases(id) ON DELETE CASCADE NOT NULL,
            schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE NOT NULL,
            table_name TEXT NOT NULL,
            ai_description TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS column_descriptions (
            id SERIAL PRIMARY KEY,
            table_id INTEGER REFERENCES schema_tables(id) ON DELETE CASCADE NOT NULL,
            column_name TEXT NOT NULL,
            column_type TEXT,
            ai_description TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- AI Chat & Memory tables
        CREATE TABLE IF NOT EXISTS ai_sessions (
            id TEXT PRIMARY KEY,
            active_connection_id INTEGER REFERENCES active_connections(id) ON DELETE CASCADE,
            session_name TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            last_activity TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_conversations (
            id TEXT PRIMARY KEY,
            session_id TEXT REFERENCES ai_sessions(id) ON DELETE CASCADE NOT NULL,
            database_id INTEGER REFERENCES databases(id) ON DELETE SET NULL,
            schema_id INTEGER REFERENCES schemas(id) ON DELETE SET NULL,
            messages TEXT,
            timestamp TIMESTAMP DEFAULT NOW() NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_long_term_memories (
            id TEXT PRIMARY KEY,
            conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
            database_id INTEGER REFERENCES databases(id) ON DELETE SET NULL,
            schema_id INTEGER REFERENCES schemas(id) ON DELETE SET NULL,
            scope_level TEXT NOT NULL DEFAULT 'global',
            content TEXT NOT NULL,
            embedding TEXT,
            memory_type TEXT NOT NULL DEFAULT 'extracted',
            importance_score REAL NOT NULL DEFAULT 1.0,
            access_count INTEGER NOT NULL DEFAULT 0,
            last_accessed TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Insert default database types
        INSERT INTO db_types (name) VALUES ('postgresql'), ('mysql'), ('mssql'), ('clickhouse'), ('snowflake')
        ON CONFLICT (name) DO NOTHING;

        -- Insert default connection statuses
        INSERT INTO connection_statuses (status) VALUES ('active'), ('inactive'), ('error'), ('testing')
        ON CONFLICT (status) DO NOTHING;
    `)

    console.log('✅ Database initialized with AI tables')
}

export { pglite }
