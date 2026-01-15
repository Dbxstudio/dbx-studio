import { z } from 'zod'

// Supported database dialects
export const dialects = ['postgresql', 'mysql', 'mssql', 'clickhouse', 'snowflake'] as const
export type Dialect = typeof dialects[number]

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    count: number
    page: number
    pageSize: number
    totalPages: number
}

// Connection types
export interface Connection {
    id: string
    name: string
    dialect: Dialect
    host?: string
    port?: number
    database?: string
    username?: string
    password?: string
    ssl?: boolean
    // Snowflake specific
    account?: string
    warehouse?: string
    role?: string
    // Metadata
    createdAt: Date
    updatedAt?: Date
}

// Schema types
export interface DatabaseSchema {
    name: string
    tables: TableSchema[]
}

export interface TableSchema {
    name: string
    schema: string
    columns: ColumnSchema[]
    primaryKey?: string[]
    rowCount?: number
}

export interface ColumnSchema {
    name: string
    type: string
    nullable: boolean
    defaultValue?: string
    isPrimaryKey: boolean
    isForeignKey: boolean
    references?: {
        table: string
        column: string
    }
}

// Query types
export interface QueryResult {
    columns: string[]
    rows: Record<string, unknown>[]
    rowCount: number
    executionTime: number
}

// Zod schemas for validation
export const dialectSchema = z.enum(dialects)

export const connectionSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    dialect: dialectSchema,
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional().default(false),
    account: z.string().optional(),
    warehouse: z.string().optional(),
    role: z.string().optional(),
})

export type ConnectionInput = z.infer<typeof connectionSchema>
