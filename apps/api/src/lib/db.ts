import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import consola from 'consola'

// Connection pool for database connections
const connectionPool: Map<string, ReturnType<typeof postgres>> = new Map()

export interface ConnectionConfig {
    host: string
    port: number
    database: string
    username: string
    password: string
    ssl?: boolean
}

/**
 * Get or create a PostgreSQL connection
 */
export function getPostgresConnection(id: string, config: ConnectionConfig) {
    if (connectionPool.has(id)) {
        return connectionPool.get(id)!
    }

    const sql = postgres({
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl ? 'require' : false,
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
    })

    connectionPool.set(id, sql)
    consola.info(`Created new connection: ${id}`)

    return sql
}

/**
 * Get Drizzle ORM instance for a connection
 */
export function getDrizzle(id: string, config: ConnectionConfig) {
    const sql = getPostgresConnection(id, config)
    return drizzle(sql)
}

/**
 * Close a specific connection
 */
export async function closeConnection(id: string) {
    const conn = connectionPool.get(id)
    if (conn) {
        await conn.end()
        connectionPool.delete(id)
        consola.info(`Closed connection: ${id}`)
    }
}

/**
 * Close all connections
 */
export async function closeAllConnections() {
    for (const [id, conn] of connectionPool.entries()) {
        await conn.end()
        consola.info(`Closed connection: ${id}`)
    }
    connectionPool.clear()
}

/**
 * Test a database connection
 */
export async function testConnection(config: ConnectionConfig): Promise<{ success: boolean; latency?: number; error?: string }> {
    const start = performance.now()

    try {
        const sql = postgres({
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
            ssl: config.ssl ? 'require' : false,
            connect_timeout: 10,
        })

        await sql`SELECT 1`
        await sql.end()

        const latency = Math.round(performance.now() - start)

        return { success: true, latency }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
