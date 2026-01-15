/**
 * AI Providers with Tool Support
 * Enhanced AI provider functions with full tool calling capabilities
 * 
 * Supported Providers:
 * - OpenAI (GPT-4, GPT-5)
 * - Anthropic Claude (Claude 3, 4)
 * - AWS Bedrock (Claude on AWS)
 */

import consola from 'consola'
import { getOpenAITools, getAnthropicTools } from './tools'
import { executeTool, processToolCalls } from './toolExecutor'

export interface AIResponse {
    success: boolean
    message?: string
    sql?: string
    thinking?: string
    error?: string
    toolCalls?: Array<{
        tool: string
        input: Record<string, any>
        result: any
    }>
    chartConfig?: {
        type: string
        title: string
        options: any
        dataQuery: string
    }
}

interface ToolContext {
    connectionId: string
    schemaName?: string
}

// System prompt for SQL generation with tools
const SYSTEM_PROMPT_WITH_TOOLS = `You are an expert SQL assistant with access to database tools. 

Available tools:
- read_schema: Get database schema information
- get_table_data: Preview table data
- execute_query: Run SQL queries
- generate_chart: Create visualizations
- describe_table: Get table details
- get_table_stats: Get statistics

When the user asks a question:
1. First use read_schema or describe_table to understand the database structure
2. Then formulate the appropriate SQL query
3. Use execute_query to run the query
4. If visualization is requested, use generate_chart

Always use tools to verify your understanding before generating SQL.
Return clear, executable SQL queries.`

/**
 * Call OpenAI API with Tool Support
 */
export async function callOpenAIWithTools(
    query: string,
    apiKey: string,
    model: string = 'gpt-4o',
    context: ToolContext,
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        consola.info(`🤖 Calling OpenAI with tools: ${model}`)

        const systemPrompt = schemaContext
            ? `${SYSTEM_PROMPT_WITH_TOOLS}\n\nCurrent Database Schema:\n${schemaContext}`
            : SYSTEM_PROMPT_WITH_TOOLS

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
        ]

        const tools = getOpenAITools()

        // First API call
        let response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                tools,
                tool_choice: 'auto',
                temperature: 0.1,
                max_tokens: 4096
            })
        })

        if (!response.ok) {
            const errorData = await response.json() as any
            throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`)
        }

        let data = await response.json() as any
        let assistantMessage = data.choices?.[0]?.message

        const allToolCalls: Array<{ tool: string; input: any; result: any }> = []

        // Process tool calls if any
        while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
            consola.info(`🔧 Processing ${assistantMessage.tool_calls.length} tool calls`)

            // Add assistant message to conversation
            messages.push(assistantMessage)

            // Execute each tool call
            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name
                const toolInput = JSON.parse(toolCall.function.arguments)

                consola.info(`🔧 Executing tool: ${toolName}`, toolInput)

                const result = await executeTool(toolName, toolInput, context)

                allToolCalls.push({
                    tool: toolName,
                    input: toolInput,
                    result: result.result
                })

                // Add tool result to conversation
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                })
            }

            // Continue conversation with tool results
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model,
                    messages,
                    tools,
                    tool_choice: 'auto',
                    temperature: 0.1,
                    max_tokens: 4096
                })
            })

            data = await response.json() as any
            assistantMessage = data.choices?.[0]?.message
        }

        const content = assistantMessage?.content || ''
        const sql = extractSQL(content)

        // Check for chart configuration in tool results
        const chartCall = allToolCalls.find(tc => tc.tool === 'generate_chart')

        return {
            success: true,
            message: content,
            sql: sql || undefined,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            chartConfig: chartCall?.result
        }

    } catch (error) {
        consola.error('❌ OpenAI API error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'OpenAI API request failed'
        }
    }
}

/**
 * Call Anthropic Claude API with Tool Support
 */
export async function callAnthropicWithTools(
    query: string,
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022',
    context: ToolContext,
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        consola.info(`🤖 Calling Anthropic with tools: ${model}`)

        const systemPrompt = schemaContext
            ? `${SYSTEM_PROMPT_WITH_TOOLS}\n\nCurrent Database Schema:\n${schemaContext}`
            : SYSTEM_PROMPT_WITH_TOOLS

        const tools = getAnthropicTools()

        let messages: any[] = [{ role: 'user', content: query }]
        const allToolCalls: Array<{ tool: string; input: any; result: any }> = []

        // First API call
        let response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages,
                tools
            })
        })

        if (!response.ok) {
            const errorData = await response.json() as any
            throw new Error(errorData?.error?.message || `Anthropic API error: ${response.status}`)
        }

        let data = await response.json() as any

        // Process tool calls in a loop
        while (data.stop_reason === 'tool_use') {
            const toolUseBlocks = data.content.filter((block: any) => block.type === 'tool_use')

            consola.info(`🔧 Processing ${toolUseBlocks.length} tool calls`)

            // Add assistant message
            messages.push({ role: 'assistant', content: data.content })

            // Execute tools and collect results
            const toolResults: any[] = []
            for (const toolUse of toolUseBlocks) {
                const result = await executeTool(toolUse.name, toolUse.input, context)

                allToolCalls.push({
                    tool: toolUse.name,
                    input: toolUse.input,
                    result: result.result
                })

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result)
                })
            }

            // Add tool results
            messages.push({ role: 'user', content: toolResults })

            // Continue conversation
            response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages,
                    tools
                })
            })

            data = await response.json() as any
        }

        // Extract final text response
        const textBlocks = data.content?.filter((block: any) => block.type === 'text') || []
        const content = textBlocks.map((b: any) => b.text).join('\n')
        const sql = extractSQL(content)

        const chartCall = allToolCalls.find(tc => tc.tool === 'generate_chart')

        return {
            success: true,
            message: content,
            sql: sql || undefined,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            chartConfig: chartCall?.result
        }

    } catch (error) {
        consola.error('❌ Anthropic API error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Anthropic API request failed'
        }
    }
}

/**
 * Call AWS Bedrock with Tool Support (Claude models)
 */
export async function callBedrockWithTools(
    query: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string = 'us-east-1',
    model: string = 'us.anthropic.claude-3-5-sonnet-20241022-v1:0',
    context: ToolContext,
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        consola.info(`🤖 Calling AWS Bedrock with tools: ${model}`)

        const systemPrompt = schemaContext
            ? `${SYSTEM_PROMPT_WITH_TOOLS}\n\nCurrent Database Schema:\n${schemaContext}`
            : SYSTEM_PROMPT_WITH_TOOLS

        const tools = getAnthropicTools()
        const allToolCalls: Array<{ tool: string; input: any; result: any }> = []

        // Bedrock endpoint
        const endpoint = `https://bedrock-runtime.${region}.amazonaws.com`
        const url = `${endpoint}/model/${model}/invoke`

        // Build request body
        const body = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: query }],
            tools
        }

        // AWS Signature V4 signing would go here
        // For now, we'll use a simplified approach
        // In production, use @aws-sdk/client-bedrock-runtime

        consola.warn('⚠️ AWS Bedrock tool calling requires SDK integration')

        // Fallback to simple request without tools
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // AWS auth headers would be added here
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            // If Bedrock fails, fall back to Anthropic direct if possible
            consola.warn('⚠️ Bedrock request failed, tool calling may not work')
            return {
                success: false,
                error: 'AWS Bedrock tool calling requires AWS SDK. Please use Anthropic Claude directly.'
            }
        }

        const data = await response.json() as any
        const content = data.content?.[0]?.text || ''
        const sql = extractSQL(content)

        return {
            success: true,
            message: content,
            sql: sql || undefined,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined
        }

    } catch (error) {
        consola.error('❌ AWS Bedrock API error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'AWS Bedrock API request failed'
        }
    }
}

/**
 * Extract SQL from text response
 */
function extractSQL(text: string): string | null {
    if (!text) return null

    // Try to extract from ```sql ... ``` blocks
    const sqlBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i)
    if (sqlBlockMatch && sqlBlockMatch[1]) {
        return sqlBlockMatch[1].trim()
    }

    // Try to extract from ``` ... ``` blocks
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch && codeBlockMatch[1]) {
        const content = codeBlockMatch[1].trim()
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/i.test(content)) {
            return content
        }
    }

    // Try to find SQL statement in text
    const sqlMatch = text.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|WITH)[\s\S]*?;/i)
    if (sqlMatch) {
        return sqlMatch[0].trim()
    }

    return null
}
