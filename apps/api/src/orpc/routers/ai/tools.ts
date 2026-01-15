/**
 * AI Tools Configuration
 * Defines tools the AI can use for database operations
 */

export interface AITool {
    name: string
    description: string
    input_schema: {
        type: 'object'
        properties: Record<string, any>
        required?: string[]
    }
}

// Define all available AI tools
export const AI_TOOLS: AITool[] = [
    {
        name: 'read_schema',
        description: 'Get the database schema including tables, columns, types, and relationships. Use this to understand the database structure before writing queries.',
        input_schema: {
            type: 'object',
            properties: {
                schema_name: {
                    type: 'string',
                    description: 'The schema name to read (e.g., "public")'
                },
                include_columns: {
                    type: 'boolean',
                    description: 'Whether to include column details for each table'
                }
            },
            required: ['schema_name']
        }
    },
    {
        name: 'get_table_data',
        description: 'Get sample data from a table. Use this to preview data structure and values.',
        input_schema: {
            type: 'object',
            properties: {
                table_name: {
                    type: 'string',
                    description: 'The table name to get data from'
                },
                schema_name: {
                    type: 'string',
                    description: 'The schema name (default: public)'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of rows to return (default: 10, max: 100)'
                },
                columns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific columns to return (optional)'
                }
            },
            required: ['table_name']
        }
    },
    {
        name: 'execute_query',
        description: 'Execute a SQL query and return results. Use this to run SELECT queries for data retrieval.',
        input_schema: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'The SQL query to execute (SELECT only for safety)'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum rows to return (default: 100)'
                }
            },
            required: ['sql']
        }
    },
    {
        name: 'generate_chart',
        description: 'Generate a chart/graph visualization from data. Specify chart type and data configuration.',
        input_schema: {
            type: 'object',
            properties: {
                chart_type: {
                    type: 'string',
                    enum: ['bar', 'line', 'pie', 'scatter', 'area', 'histogram'],
                    description: 'Type of chart to generate'
                },
                title: {
                    type: 'string',
                    description: 'Chart title'
                },
                x_axis: {
                    type: 'string',
                    description: 'Column name for X axis'
                },
                y_axis: {
                    type: 'string',
                    description: 'Column name for Y axis'
                },
                data_query: {
                    type: 'string',
                    description: 'SQL query to get data for the chart'
                },
                group_by: {
                    type: 'string',
                    description: 'Optional column to group by (for categorical charts)'
                }
            },
            required: ['chart_type', 'title', 'data_query']
        }
    },
    {
        name: 'describe_table',
        description: 'Get detailed information about a specific table including columns, types, constraints, and foreign keys.',
        input_schema: {
            type: 'object',
            properties: {
                table_name: {
                    type: 'string',
                    description: 'The table name to describe'
                },
                schema_name: {
                    type: 'string',
                    description: 'The schema name (default: public)'
                }
            },
            required: ['table_name']
        }
    },
    {
        name: 'get_table_stats',
        description: 'Get statistics about a table including row count, column distributions, and null counts.',
        input_schema: {
            type: 'object',
            properties: {
                table_name: {
                    type: 'string',
                    description: 'The table to get stats for'
                },
                schema_name: {
                    type: 'string',
                    description: 'The schema name (default: public)'
                }
            },
            required: ['table_name']
        }
    }
]

// Convert tools to OpenAI format
export function getOpenAITools() {
    return AI_TOOLS.map(tool => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
        }
    }))
}

// Convert tools to Anthropic/Claude format
export function getAnthropicTools() {
    return AI_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema
    }))
}

// Get tool by name
export function getToolByName(name: string): AITool | undefined {
    return AI_TOOLS.find(t => t.name === name)
}
