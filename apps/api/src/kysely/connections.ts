import type { DatabaseType, Connection } from '../drizzle/schema/connections'
import { Kysely, PostgresDialect, MysqlDialect } from 'kysely'
import pg from 'pg'
import mysql from 'mysql2'
import mssql from 'mssql'
import { createClient as createClickHouseClient } from '@clickhouse/client'

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
        const client = createClickHouseClient({
            host: `${connection.protocol || 'http'}://${connection.host || 'localhost'}:${connection.port || 8123}`,
            username: connection.username || 'default',
            password: connection.password || '',
            database: connection.database || 'default',
        })

        connectionPools.set(cacheKey, client)
    }

    return connectionPools.get(cacheKey) as ReturnType<typeof createClickHouseClient>
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
            }
        } catch (error) {
            console.error(`Error closing connection ${key}:`, error)
        }
    }
    connectionPools.clear()
}
