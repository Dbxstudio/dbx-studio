/**
 * AI Tool Executor
 * Executes tool calls made by AI and returns results
 */

import { db } from '~/drizzle'
import { schemaTables } from '~/drizzle/schema/ai-tables'
import { connections } from '~/drizzle/schema/connections'
import { eq } from 'drizzle-orm'
import consola from 'consola'

interface ToolResult {
    success: boolean
    result?: any
    error?: string
}

interface ToolContext {
    connectionId: string
    schemaName?: string
}

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
    toolName: string,
    toolInput: any,
    context: ToolContext
): Promise<ToolResult> {
    consola.info(`🔧 Executing tool: ${toolName}`, toolInput)

    try {
        switch (toolName) {
            case 'read_schema':
                return await executeReadSchema(toolInput, context)

            case 'get_table_data':
                return await executeGetTableData(toolInput, context)

            case 'execute_query':
                return await executeQuery(toolInput, context)

            case 'generate_chart':
                return await executeGenerateChart(toolInput, context)

            case 'describe_table':
                return await executeDescribeTable(toolInput, context)

            case 'get_table_stats':
                return await executeGetTableStats(toolInput, context)

            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}`
                }
        }
    } catch (error) {
        consola.error(`❌ Tool execution error: ${toolName}`, error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed'
        }
    }
}

/**
 * Read database schema
 */
async function executeReadSchema(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const schemaName = input.schema_name || 'public'

    // Get tables from our schema store
    const tables = await db.query.schemaTables.findMany()

    const tableList = tables
        .filter(t => t.tableName)
        .map(t => ({
            name: t.tableName,
            description: t.aiDescription || 'No description'
        }))

    return {
        success: true,
        result: {
            schema: schemaName,
            tables: tableList,
            table_count: tableList.length
        }
    }
}

/**
 * Get sample data from a table
 */
async function executeGetTableData(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const { table_name, schema_name = 'public', limit = 10 } = input

    // Build SELECT query
    const sql = `SELECT * FROM "${schema_name}"."${table_name}" LIMIT ${Math.min(limit, 100)}`

    return {
        success: true,
        result: {
            table: table_name,
            schema: schema_name,
            query_to_execute: sql,
            message: 'Query generated. Frontend should execute this query to get actual data.'
        }
    }
}

/**
 * Execute a SQL query
 */
async function executeQuery(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const { sql, limit = 100 } = input

    // Safety check - only allow SELECT
    const normalizedSql = sql.trim().toUpperCase()
    if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH')) {
        return {
            success: false,
            error: 'Only SELECT queries are allowed for safety.'
        }
    }

    // Add LIMIT if not present
    let finalSql = sql
    if (!normalizedSql.includes('LIMIT')) {
        finalSql = `${sql.trim().replace(/;$/, '')} LIMIT ${limit}`
    }

    return {
        success: true,
        result: {
            sql: finalSql,
            message: 'Query prepared. Frontend will execute and display results.',
            execution_pending: true
        }
    }
}

/**
 * Generate a chart configuration
 */
async function executeGenerateChart(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const { chart_type, title, x_axis, y_axis, data_query, group_by } = input

    // Validate chart type
    const validTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'histogram']
    if (!validTypes.includes(chart_type)) {
        return {
            success: false,
            error: `Invalid chart type. Valid types: ${validTypes.join(', ')}`
        }
    }

    // Build chart configuration
    const chartConfig = {
        type: chart_type,
        title,
        options: {
            xAxis: x_axis,
            yAxis: y_axis,
            groupBy: group_by
        },
        dataQuery: data_query,
        message: 'Chart configuration generated. Frontend should execute query and render chart.'
    }

    return {
        success: true,
        result: chartConfig
    }
}

/**
 * Describe a table in detail
 */
async function executeDescribeTable(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const { table_name, schema_name = 'public' } = input

    const tableInfo = await db.query.schemaTables.findFirst({
        where: eq(schemaTables.tableName, table_name)
    })

    if (!tableInfo) {
        return {
            success: false,
            error: `Table '${schema_name}.${table_name}' not found in metadata`
        }
    }

    return {
        success: true,
        result: {
            table: table_name,
            schema: schema_name,
            description: tableInfo.aiDescription || 'No description available',
            created_at: tableInfo.createdAt,
            updated_at: tableInfo.updatedAt
        }
    }
}

/**
 * Get table statistics
 */
async function executeGetTableStats(
    input: any,
    context: ToolContext
): Promise<ToolResult> {
    const { table_name, schema_name = 'public' } = input

    const tableInfo = await db.query.schemaTables.findFirst({
        where: eq(schemaTables.tableName, table_name)
    })

    if (!tableInfo) {
        return {
            success: false,
            error: `Table '${schema_name}.${table_name}' not found in metadata`
        }
    }

    return {
        success: true,
        result: {
            table: table_name,
            schema: schema_name,
            statistics: {
                description: tableInfo.aiDescription,
                message: 'For detailed column statistics, execute appropriate SQL queries.'
            }
        }
    }
}

/**
 * Process multiple tool calls in sequence
 */
export async function processToolCalls(
    toolCalls: Array<{ name: string; input: Record<string, any> }>,
    context: ToolContext
): Promise<Array<{ tool: string; result: ToolResult }>> {
    const results = []

    for (const call of toolCalls) {
        const result = await executeTool(call.name, call.input, context)
        results.push({ tool: call.name, result })
    }

    return results
}
