import type { DatabaseType, Connection } from '../drizzle/schema/connections'
import { Kysely, PostgresDialect, MysqlDialect, SqliteDialect } from 'kysely'
import pg from 'pg'
import mysql from 'mysql2'
import mssql from 'mssql'
import { createClient as createClickHouseClient } from '@clickhouse/client-web'
import snowflake from 'snowflake-sdk'
// Check if we are running in Bun
const isBun = typeof Bun !== 'undefined'

// Dynamically import BunSQLite or use a shim for Node.js
let BunSQLite: any
if (isBun) {
    try {
        // @ts-ignore
        const sqlite = await import('bun:sqlite')
        BunSQLite = sqlite.Database
    } catch (e) {
        console.warn('Failed to load bun:sqlite even though Bun was detected')
    }
} else {
    // Shim for Node.js to prevent crash - users on Node should use other dialects
    BunSQLite = class {
        constructor() { throw new Error('bun:sqlite is only available in Bun runtime. Please use SQLite with a Node-compatible driver.') }
        close() {}
    }
}

import { closeAllBigQueryConnections, closeBigQueryConnection } from './bigquery'

// Generic database interface for Kysely
export interface Database {
    [table: string]: Record<string, unknown>
}

// Connection pool cache
const connectionPools = new Map<string, unknown>()

/**
 * Create a PostgreSQL Kysely instance (cached)
 */
export function createPostgresConnection(connection: Connection): Kysely<Database> {
    const cacheKey = `postgres:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        const pool = new pg.Pool({
            host: connection.host || undefined,
            port: connection.port || undefined,
            database: connection.database || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
            connectionString: connection.connectionString || undefined,
            max: 10,
            idleTimeoutMillis: 30000,
        })

        connectionPools.set(cacheKey, pool)
    }

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: connectionPools.get(cacheKey) as pg.Pool,
        }),
    })
}

/**
 * Create a temporary PostgreSQL Kysely instance (not cached, for testing)
 * This pool should be destroyed after use
 */
export function createTempPostgresConnection(connection: Partial<Connection>): { kysely: Kysely<Database>, pool: pg.Pool } {
    const pool = new pg.Pool({
        host: connection.host || undefined,
        port: connection.port || undefined,
        database: connection.database || undefined,
        user: connection.username || undefined,
        password: connection.password || undefined,
        ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
        connectionString: connection.connectionString || undefined,
        max: 2,
        idleTimeoutMillis: 5000,
    })

    const kysely = new Kysely<Database>({
        dialect: new PostgresDialect({ pool }),
    })

    return { kysely, pool }
}

/**
 * Create a MySQL Kysely instance (cached)
 */
export function createMysqlConnection(connection: Connection): Kysely<Database> {
    const cacheKey = `mysql:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        const pool = mysql.createPool({
            host: connection.host || undefined,
            port: connection.port || undefined,
            database: connection.database || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
            connectionLimit: 10,
        })

        connectionPools.set(cacheKey, pool)
    }

    return new Kysely<Database>({
        dialect: new MysqlDialect({
            pool: connectionPools.get(cacheKey) as ReturnType<typeof mysql.createPool>,
        }),
    })
}

/**
 * Create a temporary MySQL Kysely instance (not cached, for testing)
 */
export function createTempMysqlConnection(connection: Partial<Connection>): { kysely: Kysely<Database>, pool: ReturnType<typeof mysql.createPool> } {
    const pool = mysql.createPool({
        host: connection.host || undefined,
        port: connection.port || undefined,
        database: connection.database || undefined,
        user: connection.username || undefined,
        password: connection.password || undefined,
        ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
        connectionLimit: 2,
    })

    const kysely = new Kysely<Database>({
        dialect: new MysqlDialect({ pool }),
    })

    return { kysely, pool }
}

/**
 * Create MSSQL connection info (cached)
 */
export async function createMssqlConnection(connection: Connection): Promise<mssql.ConnectionPool> {
    const cacheKey = `mssql:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        const config: mssql.config = {
            server: connection.host || 'localhost',
            port: connection.port || 1433,
            database: connection.database || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            options: {
                encrypt: connection.ssl || false,
                trustServerCertificate: true,
            },
        }

        const pool = new mssql.ConnectionPool(config)
        await pool.connect()
        connectionPools.set(cacheKey, pool)
    }

    return connectionPools.get(cacheKey) as mssql.ConnectionPool
}

/**
 * Create ClickHouse client (cached)
 */
export function createClickHouseConnection(connection: Connection) {
    const cacheKey = `clickhouse:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        // Force SSL bypass for Bun/Node environments
        if (connection.protocol === 'https') {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        const client = createClickHouseClient({
            host: `${connection.protocol || 'http'}://${connection.host || 'localhost'}:${connection.port || 8123}`,
            username: connection.username || 'default',
            password: connection.password || '',
            database: connection.database || 'default',
            // @ts-ignore - settings type is slightly different but same keys work
            clickhouse_settings: {
                max_execution_time: 60,
            },
        })

        connectionPools.set(cacheKey, client)
    }

    return connectionPools.get(cacheKey) as ReturnType<typeof createClickHouseClient>
}

/**
 * Create a temporary ClickHouse client for testing (not cached)
 */
export function createTempClickHouseConnection(connection: Partial<Connection>) {
    // Force SSL bypass for Bun/Node environments where standard config might be ignored
    if (connection.protocol === 'https') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    
    return createClickHouseClient({
        host: `${connection.protocol || 'http'}://${connection.host || 'localhost'}:${connection.port || 8123}`,
        username: connection.username || 'default',
        password: connection.password || '',
        database: connection.database || 'default',
        // @ts-ignore
        clickhouse_settings: {
            max_execution_time: 60,
        },
    })
}

/**
 * Create a Snowflake connection (cached)
 */
export function createSnowflakeConnection(connection: Connection): snowflake.Connection {
    const cacheKey = `snowflake:${connection.id}`

    // Ensure we normalise the account formatting
    const account = (connection.account || '').replace(/\.snowflakecomputing\.com$/, '')

    if (!connectionPools.has(cacheKey)) {
        const client = snowflake.createConnection({
            account: account,
            username: connection.username || '',
            password: connection.password || '',
            database: connection.database || undefined,
            warehouse: connection.warehouse || undefined,
            role: connection.role || undefined,
        })
        connectionPools.set(cacheKey, client)
    }

    return connectionPools.get(cacheKey) as snowflake.Connection
}

/**
 * Create a temporary Snowflake connection for testing (not cached)
 */
export function createTempSnowflakeConnection(connection: Partial<Connection>): snowflake.Connection {
    const account = (connection.account || '').replace(/\.snowflakecomputing\.com$/, '')
    return snowflake.createConnection({
        account: account,
        username: connection.username || '',
        password: connection.password || '',
        database: connection.database || undefined,
        warehouse: connection.warehouse || undefined,
        role: connection.role || undefined,
    })
}

/**
 * Execute a Snowflake query using the SDK
 */
export function executeSnowflakeQuery(client: snowflake.Connection, querySql: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        // Automatically connect if not already connected
        const exec = () => {
            client.execute({
                sqlText: querySql,
                complete: (err, stmt, rows) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(rows || [])
                    }
                }
            })
        }

        if (client.isUp()) {
            exec()
        } else {
            client.connect((err) => {
                if (err) reject(err)
                else exec()
            })
        }
    })
}

/**
 * Create a Supabase connection (reuses PostgreSQL via connection string or pooler URL)
 * Supabase projects expose a standard PostgreSQL endpoint
 */
export function createSupabaseConnection(connection: Connection): Kysely<Database> {
    const cacheKey = `supabase:${connection.id}`

    const getSupabaseDb = (db?: string | null) => {
        if (!db || db.toLowerCase() === 'supabase connection') return 'postgres'
        return db
    }

    if (!connectionPools.has(cacheKey)) {
        // Supabase stores its connection string in connectionString, or build from host/port/db/user/pass
        const pool = new pg.Pool({
            connectionString: connection.connectionString || undefined,
            host: connection.connectionString ? undefined : (connection.host || undefined),
            port: connection.connectionString ? undefined : (connection.port || 5432),
            database: connection.connectionString ? undefined : getSupabaseDb(connection.database),
            user: connection.connectionString ? undefined : (connection.username || undefined),
            password: connection.connectionString ? undefined : (connection.password || undefined),
            ssl: { rejectUnauthorized: false }, // Supabase always requires SSL
            max: 10,
            idleTimeoutMillis: 30000,
        })
        connectionPools.set(cacheKey, pool)
    }

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: connectionPools.get(cacheKey) as pg.Pool,
        }),
    })
}

/**
 * Create a temporary Supabase connection for testing (not cached)
 */
export function createTempSupabaseConnection(connection: Partial<Connection>): { kysely: Kysely<Database>; pool: pg.Pool } {
    const getSupabaseDb = (db?: string | null) => {
        if (!db || db.toLowerCase() === 'supabase connection') return 'postgres'
        return db
    }

    const pool = new pg.Pool({
        connectionString: connection.connectionString || undefined,
        host: connection.connectionString ? undefined : (connection.host || undefined),
        port: connection.connectionString ? undefined : (connection.port || 5432),
        database: connection.connectionString ? undefined : getSupabaseDb(connection.database),
        user: connection.connectionString ? undefined : (connection.username || undefined),
        password: connection.connectionString ? undefined : (connection.password || undefined),
        ssl: { rejectUnauthorized: false },
        max: 2,
        idleTimeoutMillis: 5000,
    })
    const kysely = new Kysely<Database>({
        dialect: new PostgresDialect({ pool }),
    })
    return { kysely, pool }
}

/**
 * Create a Redshift connection (reuses PostgreSQL driver)
 */
export function createRedshiftConnection(connection: Connection): Kysely<Database> {
    const cacheKey = `redshift:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        const pool = new pg.Pool({
            host: connection.host || undefined,
            port: connection.port || 5439, // Redshift default port
            database: connection.database || undefined,
            user: connection.username || undefined,
            password: connection.password || undefined,
            ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
            connectionString: connection.connectionString || undefined,
            max: 10,
            idleTimeoutMillis: 30000,
        })
        connectionPools.set(cacheKey, pool)
    }

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: connectionPools.get(cacheKey) as pg.Pool,
        }),
    })
}

/**
 * Create a temporary Redshift connection for testing
 */
export function createTempRedshiftConnection(connection: Partial<Connection>): { kysely: Kysely<Database>; pool: pg.Pool } {
    const pool = new pg.Pool({
        host: connection.host || undefined,
        port: connection.port || 5439,
        database: connection.database || undefined,
        user: connection.username || undefined,
        password: connection.password || undefined,
        ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
        connectionString: connection.connectionString || undefined,
        max: 2,
        idleTimeoutMillis: 5000,
    })
    const kysely = new Kysely<Database>({
        dialect: new PostgresDialect({ pool }),
    })
    return { kysely, pool }
}

/**
 * Create a SQLite connection
 */
export function createSqliteConnection(connection: Connection): Kysely<Database> {
    const cacheKey = `sqlite:${connection.id}`

    if (!connectionPools.has(cacheKey)) {
        // For SQLite, the database name is typically the path, or connectionString can be the path
        // Strip surrounding quotes that users may accidentally include
        const rawPath = connection.connectionString || connection.database || ':memory:'
        const dbPath = rawPath.replace(/^["']|["']$/g, '').trim()
        const sqlite = new BunSQLite(dbPath)
        connectionPools.set(cacheKey, sqlite)
    }

    return new Kysely<Database>({
        dialect: new SqliteDialect({
            database: connectionPools.get(cacheKey) as any,
        }),
    })
}

/**
 * Create a temporary SQLite connection for testing
 */
export function createTempSqliteConnection(connection: Partial<Connection>): { kysely: Kysely<Database>; db: BunSQLite } {
    // Strip surrounding quotes that users may accidentally include
    const rawPath = connection.connectionString || connection.database || ':memory:'
    const dbPath = rawPath.replace(/^["']|["']$/g, '').trim()
    const db = new BunSQLite(dbPath)
    const kysely = new Kysely<Database>({
        dialect: new SqliteDialect({ database: db as any }),
    })
    return { kysely, db }
}

/**
 * Get database connection based on type (cached)
 */
export function getConnection(connection: Connection) {
    switch (connection.type) {
        case 'postgresql':
            return createPostgresConnection(connection)
        case 'mysql':
            return createMysqlConnection(connection)
        case 'supabase':
            return createSupabaseConnection(connection)
        case 'redshift':
            return createRedshiftConnection(connection)
        case 'sqlite':
            return createSqliteConnection(connection)
        case 'bigquery':
            throw new Error('BigQuery uses a dedicated client, not Kysely')
        default:
            throw new Error(`Unsupported database type: ${connection.type}`)
    }
}

/**
 * Close and remove a connection from cache
 */
export async function closeConnection(connectionId: string, type: DatabaseType) {
    // Map database type to cache key prefix (must match the prefixes used in create functions)
    const typeToPrefix: Record<DatabaseType, string> = {
        postgresql: 'postgres',
        mysql: 'mysql',
        mssql: 'mssql',
        clickhouse: 'clickhouse',
        snowflake: 'snowflake',
        supabase: 'supabase',
        redshift: 'redshift',
        sqlite: 'sqlite',
        bigquery: 'bigquery',
    }

    const cacheKey = `${typeToPrefix[type] || type}:${connectionId}`
    const pool = connectionPools.get(cacheKey)

    if (!pool) {
        console.log(`No cached pool found for ${cacheKey}`)
        return
    }

    console.log(`Closing connection pool: ${cacheKey}`)

    try {
        switch (type) {
            case 'postgresql':
                await (pool as pg.Pool).end()
                break
            case 'mysql':
                await (pool as ReturnType<typeof mysql.createPool>).promise().end()
                break
            case 'mssql':
                await (pool as mssql.ConnectionPool).close()
                break
            case 'clickhouse':
                await (pool as ReturnType<typeof createClickHouseClient>).close()
                break
            case 'supabase':
                await (pool as pg.Pool).end()
                break
            case 'redshift':
                await (pool as pg.Pool).end()
                break
            case 'sqlite':
                (pool as BunSQLite).close()
                break
            case 'snowflake':
                if ((pool as snowflake.Connection).isUp()) {
                    await new Promise<void>((resolve, reject) => {
                        (pool as snowflake.Connection).destroy((err) => {
                            if (err) reject(err)
                            else resolve()
                        })
                    })
                }
                break
            case 'bigquery':
                await closeBigQueryConnection(connectionId)
                break
        }
        connectionPools.delete(cacheKey)
        console.log(`Successfully closed and removed connection pool: ${cacheKey}`)
    } catch (error) {
        console.error(`Error closing connection ${connectionId}:`, error)
    }
}

/**
 * Close all connections
 */
export async function closeAllConnections() {
    for (const [key, pool] of connectionPools.entries()) {
        const [type] = key.split(':')
        try {
            switch (type) {
                case 'postgresql':
                    await (pool as pg.Pool).end()
                    break
                case 'mysql':
                    await (pool as ReturnType<typeof mysql.createPool>).promise().end()
                    break
                case 'mssql':
                    await (pool as mssql.ConnectionPool).close()
                    break
                case 'clickhouse':
                    await (pool as ReturnType<typeof createClickHouseClient>).close()
                    break
                case 'supabase':
                    await (pool as pg.Pool).end()
                    break
                case 'redshift':
                    await (pool as pg.Pool).end()
                    break
                case 'sqlite':
                    (pool as BunSQLite).close()
                    break
                case 'snowflake':
                    if ((pool as snowflake.Connection).isUp()) {
                        await new Promise<void>((resolve, reject) => {
                            (pool as snowflake.Connection).destroy((err) => {
                                if (err) reject(err)
                                else resolve()
                            })
                        })
                    }
                    break
                case 'bigquery':
                    // BigQuery SDK has no explicit close call; cache clear is enough.
                    break
            }
        } catch (error) {
            console.error(`Error closing connection ${key}:`, error)
        }
    }
    connectionPools.clear()
    await closeAllBigQueryConnections()
}
