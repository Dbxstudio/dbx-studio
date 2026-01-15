/**
 * Database Tools for AI Query Execution
 * Provides tools for executing SQL queries on connected databases
 * Based on SUMR SQL Client architecture
 */

import consola from 'consola'
import { db } from '../drizzle'
import { connections } from '../drizzle/schema/connections'
import { eq } from 'drizzle-orm'
import { getConnection } from '../kysely'

/**
 * Tool definition for database query execution
 */
export interface DatabaseTool {
    name: string
    description: string
    input_schema: {
        type: 'object'
        properties: Record<string, any>
        required: string[]
    }
}

/**
 * Create database query execution tool
 */
export function createDatabaseQueryTool(connectionId: string): DatabaseTool {
    return {
        name: 'execute_sql_query',
        description: 'Execute a SQL query on the connected database. Use this tool to run SELECT, INSERT, UPDATE, DELETE, or other SQL statements. Always return the results to the user.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The SQL query to execute. Must be valid SQL for the target database.'
                },
                database: {
                    type: 'string',
                    description: 'Optional database name to run the query against'
                }
            },
            required: ['query']
        }
    }
}

/**
 * Create database schema inspection tool (get_table_schema)
 */
export function createSchemaInspectionTool(defaultSchema?: string): DatabaseTool {
    return {
        name: 'get_table_schema',
        description: `Get detailed schema information for specified tables including foreign keys.

Returns compact, complete schema information optimized for LLM consumption.
Auto-includes schemas of FK-referenced tables for complete context.

Tips:
- Use format: schema.table1, schema.table2${defaultSchema ? ` (default schema: ${defaultSchema})` : ''}
- Always call before writing SQL to verify column names
- Schema and table names are case-sensitive in PostgreSQL`,
        input_schema: {
            type: 'object',
            properties: {
                table_names: {
                    type: 'string',
                    description: 'Comma-separated list of table names or schema.table names'
                },
                schema: {
                    type: 'string',
                    description: `Schema name${defaultSchema ? ` (default: ${defaultSchema})` : ''}`
                },
                include_foreign_keys: {
                    type: 'boolean',
                    description: 'Include foreign key relationships (default: true)'
                },
                include_fk_schemas: {
                    type: 'boolean',
                    description: 'Auto-include schemas for FK referenced tables (default: true)'
                }
            },
            required: []
        }
    }
}

/**
 * Create bar graph generation tool
 */
export function createBarGraphTool(): DatabaseTool {
    return {
        name: 'generate_bar_graph',
        description: `Execute SQL and return bar chart data as JSON. Use ONLY after seeing query results and confirming data is suitable for visualization.

Requirements:
- Query must return categorical column (x-axis) and numeric column (y-axis)
- Ideal for 2-50 rows of data
- Use get_table_schema and execute_sql_query FIRST to verify column names and data shape

Returns JSON with: type, data (x/y coordinates), title, labels, color, orientation`,
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Valid SELECT SQL query that returns data for visualization'
                },
                x_column: {
                    type: 'string',
                    description: 'Column name for x-axis (categories)'
                },
                y_column: {
                    type: 'string',
                    description: 'Column name for y-axis (numeric values)'
                },
                title: {
                    type: 'string',
                    description: 'Chart title (optional)'
                },
                x_label: {
                    type: 'string',
                    description: 'X-axis label (optional)'
                },
                y_label: {
                    type: 'string',
                    description: 'Y-axis label (optional)'
                },
                color: {
                    type: 'string',
                    description: "Bar color (optional, default: 'steelblue')"
                },
                orientation: {
                    type: 'string',
                    description: "'vertical' or 'horizontal' (optional, default: 'vertical')"
                }
            },
            required: ['query', 'x_column', 'y_column']
        }
    }
}

/**
 * Create get enums tool
 */
export function createGetEnumsTool(): DatabaseTool {
    return {
        name: 'get_enums',
        description: 'Get the list of all enum types in the database. Returns enum schema, name, and all possible values. Use this when you need to understand enum columns or valid values for enum fields.',
        input_schema: {
            type: 'object',
            properties: {},
            required: []
        }
    }
}

/**
 * Create select data tool
 */
export function createSelectDataTool(): DatabaseTool {
    return {
        name: 'select_data',
        description: `Select data from a database table with structured filtering. Use this for targeted data retrieval with filters.

Supports:
- WHERE filters with various operators (=, !=, <, >, LIKE, IN, etc.)
- ORDER BY sorting
- LIMIT and OFFSET for pagination
- Column selection

Safer than raw SQL for simple data retrieval tasks.`,
        input_schema: {
            type: 'object',
            properties: {
                tableAndSchema: {
                    type: 'object',
                    description: 'Table and schema information',
                    properties: {
                        tableName: {
                            type: 'string',
                            description: 'Table name'
                        },
                        schemaName: {
                            type: 'string',
                            description: 'Schema name (e.g., "public")'
                        }
                    },
                    required: ['tableName', 'schemaName']
                },
                whereConcatOperator: {
                    type: 'string',
                    description: 'Operator to combine WHERE conditions: "AND" or "OR" (default: "AND")'
                },
                whereFilters: {
                    type: 'array',
                    description: 'Array of filter conditions',
                    items: {
                        type: 'object',
                        properties: {
                            column: {
                                type: 'string',
                                description: 'Column name'
                            },
                            operator: {
                                type: 'string',
                                description: 'SQL operator (=, !=, <, >, <=, >=, LIKE, IN, IS NULL, etc.)'
                            },
                            values: {
                                type: 'array',
                                description: 'Values for the filter'
                            }
                        },
                        required: ['column', 'operator']
                    }
                },
                select: {
                    type: 'array',
                    description: 'Columns to select (default: all)',
                    items: {
                        type: 'string'
                    }
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of rows to return (default: 100, max: 1000)'
                },
                offset: {
                    type: 'number',
                    description: 'Number of rows to skip (default: 0)'
                },
                orderBy: {
                    type: 'object',
                    description: 'Sort order as {column_name: "ASC|DESC"}'
                }
            },
            required: ['tableAndSchema']
        }
    }
}

/**
 * Execute SQL query using Kysely
 */
export async function executeSQLQuery(
    connectionId: string,
    query: string,
    database?: string
): Promise<{ success: boolean; data?: any; error?: string; rowCount?: number }> {
    try {
        consola.info(`Executing SQL query on connection: ${connectionId}`)
        consola.info(`Query: ${query.substring(0, 200)}...`)

        // Get connection from PGLite
        const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId))

        if (!connection) {
            return {
                success: false,
                error: `No database connection found for ID: ${connectionId}`
            }
        }

        // Get Kysely instance
        const kysely = getConnection(connection)

        // Execute the query using raw SQL
        const result = await kysely.executeQuery({
            sql: query,
            parameters: [],
            query: {
                kind: 'SelectQueryNode',
                from: undefined,
                selection: undefined
            }
        } as any)

        consola.success(`Query executed successfully, rows: ${result.rows.length}`)

        return {
            success: true,
            data: result.rows,
            rowCount: result.rows.length
        }
    } catch (error: any) {
        consola.error(`SQL query execution failed: ${error.message}`)
        return {
            success: false,
            error: error.message || 'Query execution failed'
        }
    }
}

/**
 * Inspect database schema
 */
export async function inspectDatabaseSchema(
    connectionId: string,
    tableNames?: string,
    schema?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        consola.info(`Inspecting database schema for connection: ${connectionId}`)

        // Get connection from PGLite
        const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId))

        if (!connection) {
            return {
                success: false,
                error: `No database connection found for ID: ${connectionId}`
            }
        }

        // Get Kysely instance
        const kysely = getConnection(connection)

        // Get database metadata
        const introspector = kysely.introspection

        // Get list of tables
        const tables = await introspector.getTables()

        if (tableNames) {
            // Handle comma-separated table names or single table name
            const tableNameList = tableNames.split(',').map(t => {
                // Remove schema prefix if present (e.g., "public.users" -> "users")
                const parts = t.trim().split('.')
                return parts.length > 1 ? parts[parts.length - 1] : parts[0]
            })

            const requestedTables = tables.filter(t => tableNameList.includes(t.name))

            if (requestedTables.length === 0) {
                return {
                    success: false,
                    error: `No tables found matching: ${tableNames}. Available tables: ${tables.map(t => t.name).join(', ')}`
                }
            }

            // Return details for all requested tables
            return {
                success: true,
                data: {
                    tables: requestedTables.map(t => ({
                        name: t.name,
                        schema: t.schema || schema || 'public',
                        columns: t.columns.map(col => ({
                            name: col.name,
                            type: col.dataType,
                            nullable: col.isNullable
                        }))
                    }))
                }
            }
        }

        // Return all tables
        return {
            success: true,
            data: {
                tables: tables.map(t => ({
                    name: t.name,
                    schema: t.schema,
                    columns: t.columns.map(col => ({
                        name: col.name,
                        type: col.dataType,
                        nullable: col.isNullable
                    }))
                }))
            }
        }
    } catch (error: any) {
        consola.error(`Schema inspection failed: ${error.message}`)
        return {
            success: false,
            error: error.message || 'Schema inspection failed'
        }
    }
}

/**
 * Generate SQL prompt with database context
 * Matches SUMR SQL Client's generateSQLPrompt exactly
 */
export async function generateSQLPrompt(
    userQuery: string,
    connectionId: string,
    tables?: string[]
): Promise<string> {
    try {
        // Get schema information
        const schemaResult = await inspectDatabaseSchema(connectionId)

        if (!schemaResult.success || !schemaResult.data) {
            // Fallback to simple prompt
            return userQuery
        }

        // Build schema text with relevant tables
        let schemaText = ''

        const allTables = schemaResult.data.tables || []

        // Filter tables if specific ones were requested
        const relevantTables = tables && tables.length > 0
            ? allTables.filter((t: any) => tables.includes(t.name))
            : allTables.slice(0, 20) // Limit to first 20 tables if no filter

        for (const table of relevantTables) {
            schemaText += `Table: ${table.name}\n`
            schemaText += `Columns:\n`
            for (const col of table.columns) {
                schemaText += `  - ${col.name} (${col.type})${col.nullable ? ' NULL' : ' NOT NULL'}\n`
            }
            schemaText += '\n'
        }

        // Build prompt with EXACT structure from SUMR (ai-services.js line 1098-1230)
        const prompt = `You are DBX - an expert AI database assistant specialized in generating SQL queries.

<core_responsibilities>
- **PRIMARY: Understand user intent** from their natural language question
- Focus on what the user is asking RIGHT NOW - their current request is your top priority
- Generate accurate, executable SQL queries based on the provided schema
- Return ONLY the SQL query without explanations unless specifically asked
</core_responsibilities>

<database_schema>
${schemaText}
</database_schema>

<response_format>
- Return ONLY the SQL query
- Do not include markdown code blocks or explanations
- Ensure the query is syntactically correct and executable
- Use proper table and column names from the schema
</response_format>

<user_question>
${userQuery}
</user_question>`

        return prompt
    } catch (error: any) {
        consola.error(`Prompt generation failed: ${error.message}`)
        return userQuery
    }
}

/**
 * Generate bar graph from SQL query
 */
export async function generateBarGraph(
    connectionId: string,
    query: string,
    x_column: string,
    y_column: string,
    title?: string,
    x_label?: string,
    y_label?: string,
    color: string = 'steelblue',
    orientation: string = 'vertical'
): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        // Execute the query first
        const result = await executeSQLQuery(connectionId, query)

        if (!result.success || !result.data || result.data.length === 0) {
            return {
                success: false,
                error: 'Query returned no data for visualization'
            }
        }

        // Convert rows to chart data
        const chartData: any[] = []
        for (const row of result.data) {
            if (!(x_column in row)) {
                return {
                    success: false,
                    error: `Column '${x_column}' not found. Available: ${Object.keys(row).join(', ')}`
                }
            }
            if (!(y_column in row)) {
                return {
                    success: false,
                    error: `Column '${y_column}' not found. Available: ${Object.keys(row).join(', ')}`
                }
            }

            const xVal = row[x_column]
            const yVal = parseFloat(row[y_column])

            if (isNaN(yVal)) {
                return {
                    success: false,
                    error: `Column '${y_column}' contains non-numeric value: ${row[y_column]}`
                }
            }

            chartData.push({
                x: xVal !== null && xVal !== undefined ? String(xVal) : 'NULL',
                y: yVal
            })
        }

        // Limit to 50 bars
        const limitedData = chartData.slice(0, 50)
        const warning = chartData.length > 50 ? ` (limited to first 50 of ${chartData.length} rows)` : ''

        return {
            success: true,
            data: {
                type: 'bar_graph',
                data: limitedData,
                title: title || `${y_column} by ${x_column}`,
                x_label: x_label || x_column,
                y_label: y_label || y_column,
                color,
                orientation,
                warning
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Bar graph generation failed'
        }
    }
}

/**
 * Get enum types from database
 */
export async function getEnums(connectionId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId))

        if (!connection) {
            return {
                success: false,
                error: `No database connection found for ID: ${connectionId}`
            }
        }

        const kysely = getConnection(connection)

        // Query PostgreSQL enum types
        const query = `
            SELECT
                n.nspname AS schema,
                t.typname AS name,
                e.enumlabel AS value
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY n.nspname, t.typname, e.enumsortorder
        `

        const result = await kysely.executeQuery({
            sql: query,
            parameters: [],
            query: {
                kind: 'SelectQueryNode',
                from: undefined,
                selection: undefined
            }
        } as any)

        if (result.rows.length === 0) {
            return {
                success: true,
                data: {
                    status: 'success',
                    message: 'No enum types found in database',
                    enums: []
                }
            }
        }

        // Group by enum name
        const grouped: Record<string, any> = {}
        for (const row of result.rows) {
            const key = `${row.schema}.${row.name}`
            if (!grouped[key]) {
                grouped[key] = {
                    schema: row.schema,
                    name: row.name,
                    values: []
                }
            }
            grouped[key].values.push(row.value)
        }

        return {
            success: true,
            data: {
                status: 'success',
                count: Object.keys(grouped).length,
                enums: Object.values(grouped)
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Failed to fetch enums'
        }
    }
}

/**
 * Select data with structured filters
 */
export async function selectData(
    connectionId: string,
    tableAndSchema: { tableName: string; schemaName: string },
    whereConcatOperator: string = 'AND',
    whereFilters: any[] = [],
    select: string[] | null = null,
    limit: number = 100,
    offset: number = 0,
    orderBy: Record<string, string> | null = null
): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const { tableName, schemaName } = tableAndSchema
        const qualifiedTable = `"${schemaName}"."${tableName}"`

        // Build SELECT clause
        let selectClause = '*'
        if (select && select.length > 0) {
            const safeColumns = select.map(col => {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                    throw new Error(`Invalid column name: ${col}`)
                }
                return `"${col}"`
            })
            selectClause = safeColumns.join(', ')
        }

        // Build WHERE clause
        let whereClause = ''
        const params: any[] = []

        if (whereFilters && whereFilters.length > 0) {
            const conditions: string[] = []

            for (const filter of whereFilters) {
                const { column, operator, values } = filter

                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
                    throw new Error(`Invalid column name: ${column}`)
                }

                const upperOp = operator.toUpperCase()

                if (upperOp === 'IS NULL' || upperOp === 'IS NOT NULL') {
                    conditions.push(`"${column}" ${upperOp}`)
                } else if (upperOp === 'IN' || upperOp === 'NOT IN') {
                    const placeholders = values.map((v: any) => `'${String(v).replace(/'/g, "''")}'`).join(', ')
                    conditions.push(`"${column}" ${upperOp} (${placeholders})`)
                } else if (upperOp === 'BETWEEN' || upperOp === 'NOT BETWEEN') {
                    conditions.push(`"${column}" ${upperOp} '${String(values[0]).replace(/'/g, "''")}' AND '${String(values[1]).replace(/'/g, "''")}'`)
                } else {
                    conditions.push(`"${column}" ${upperOp} '${String(values[0]).replace(/'/g, "''")}'`)
                }
            }

            whereClause = `WHERE ${conditions.join(` ${whereConcatOperator} `)}`
        }

        // Build ORDER BY clause
        let orderClause = ''
        if (orderBy && Object.keys(orderBy).length > 0) {
            const orderParts: string[] = []
            for (const [col, direction] of Object.entries(orderBy)) {
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                    throw new Error(`Invalid column name in orderBy: ${col}`)
                }
                const dir = direction.toUpperCase()
                if (dir !== 'ASC' && dir !== 'DESC') {
                    throw new Error(`Invalid order direction: ${direction}`)
                }
                orderParts.push(`"${col}" ${dir}`)
            }
            orderClause = `ORDER BY ${orderParts.join(', ')}`
        }

        // Validate and cap limit
        const safeLimit = Math.min(Math.max(1, limit), 1000)
        const safeOffset = Math.max(0, offset)

        // Build final query
        const query = `
            SELECT ${selectClause}
            FROM ${qualifiedTable}
            ${whereClause}
            ${orderClause}
            LIMIT ${safeLimit}
            OFFSET ${safeOffset}
        `.trim()

        const result = await executeSQLQuery(connectionId, query)

        if (!result.success) {
            return result
        }

        const rows = result.data || []

        // Mask sensitive data
        const sensitivePatterns = [
            /password/i, /token/i, /secret/i, /api_key/i, /apikey/i,
            /card_number/i, /cardnumber/i, /cvv/i, /ssn/i, /credit_card/i
        ]

        const maskedRows = rows.map((row: any) => {
            const masked = { ...row }
            for (const key of Object.keys(masked)) {
                if (sensitivePatterns.some(pattern => pattern.test(key))) {
                    masked[key] = '****masked****'
                }
            }
            return masked
        })

        return {
            success: true,
            data: {
                status: 'success',
                count: maskedRows.length,
                rows: maskedRows.slice(0, 50),
                totalAvailable: rows.length,
                note: rows.length > 50 ? `Showing first 50 of ${rows.length} rows` : undefined
            }
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Select failed'
        }
    }
}

/**
 * Format tool call results for AI
 */
export function formatToolResult(toolName: string, result: any): string {
    if (!result.success) {
        return `Error executing ${toolName}: ${result.error}`
    }

    if (toolName === 'execute_sql_query') {
        const rowCount = result.rowCount || 0
        if (rowCount === 0) {
            return 'Query executed successfully. No rows returned.'
        }

        // Format the data as a readable string
        const data = result.data || []
        const preview = data.slice(0, 5) // Show first 5 rows

        let formatted = `Query executed successfully. Returned ${rowCount} row(s).\n\n`
        formatted += `Preview (first ${preview.length} rows):\n`
        formatted += JSON.stringify(preview, null, 2)

        if (rowCount > 5) {
            formatted += `\n\n... and ${rowCount - 5} more rows`
        }

        return formatted
    }

    if (toolName === 'inspect_database_schema' || toolName === 'get_table_schema') {
        return `Schema information:\n${JSON.stringify(result.data, null, 2)}`
    }

    return JSON.stringify(result, null, 2)
}
