/**
 * Supported database types
 */
export const DATABASE_TYPES = {
    POSTGRESQL: 'postgresql',
    MYSQL: 'mysql',
    MSSQL: 'mssql',
    CLICKHOUSE: 'clickhouse',
    SNOWFLAKE: 'snowflake',
    SQLITE: 'sqlite',
} as const

export type DatabaseType = (typeof DATABASE_TYPES)[keyof typeof DATABASE_TYPES]

/**
 * Database type display information
 */
export const DATABASE_INFO: Record<DatabaseType, { name: string; color: string; icon: string }> = {
    postgresql: { name: 'PostgreSQL', color: '#336791', icon: 'postgresql' },
    mysql: { name: 'MySQL', color: '#4479A1', icon: 'mysql' },
    mssql: { name: 'SQL Server', color: '#CC2927', icon: 'mssql' },
    clickhouse: { name: 'ClickHouse', color: '#FFCC00', icon: 'clickhouse' },
    snowflake: { name: 'Snowflake', color: '#29B5E8', icon: 'snowflake' },
    sqlite: { name: 'SQLite', color: '#003B57', icon: 'sqlite' },
}

/**
 * Default connection ports
 */
export const DEFAULT_PORTS: Record<DatabaseType, number> = {
    postgresql: 5432,
    mysql: 3306,
    mssql: 1433,
    clickhouse: 8123,
    snowflake: 443,
    sqlite: 0,
}

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
    BASE_URL: 'http://localhost:3001',
    HEALTH: '/health',
    STATUS: '/api/v1/status',
} as const

/**
 * App configuration
 */
export const APP_CONFIG = {
    NAME: 'DBX Studio',
    VERSION: '0.0.1',
    DESCRIPTION: 'AI-powered open-source database management tool',
} as const
