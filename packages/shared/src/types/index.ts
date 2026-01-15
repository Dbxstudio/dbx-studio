import type { DatabaseType } from '../constants'

/**
 * Database connection configuration
 */
export interface DatabaseConnection {
    id: string
    name: string
    type: DatabaseType
    host: string
    port: number
    database: string
    username: string
    password?: string
    ssl?: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Query result
 */
export interface QueryResult {
    columns: ColumnInfo[]
    rows: Record<string, unknown>[]
    rowCount: number
    executionTimeMs: number
}

/**
 * Column information
 */
export interface ColumnInfo {
    name: string
    type: string
    nullable: boolean
    primaryKey?: boolean
    foreignKey?: boolean
}

/**
 * Saved query
 */
export interface SavedQuery {
    id: string
    name: string
    sql: string
    connectionId: string
    createdAt: Date
    updatedAt: Date
}

/**
 * AI chat message
 */
export interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    createdAt: Date
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
    }
}
