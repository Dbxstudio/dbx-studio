/**
 * AI Router - COMPLETE REWRITE
 * Unified API matching SUMR AI SQL Client with Think mode
 *
 * Features:
 * - Query complexity analysis & automatic routing
 * - Think mode with extended reasoning
 * - Memory system (STM + LTM)
 * - Vector search / embeddings
 * - Multi-provider support (DBX, Bedrock, OpenAI, Claude)
 * - Streaming for complex queries
 */

import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import consola from 'consola'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import {
    createDatabaseQueryTool,
    createSchemaInspectionTool,
    executeSQLQuery,
    inspectDatabaseSchema,
    generateSQLPrompt,
    formatToolResult,
    type DatabaseTool,
} from '~/lib/db-tools'
import {
    analyzeQueryComplexity,
    buildThinkingPrompt,
    extractThinkingAndSQL,
    determineRouting,
    type ComplexityAnalysis
} from '~/lib/query-analyzer'

// ==================== SCHEMAS ====================

// AI Credentials schema
const credentialsSchema = z.object({
    selectedProvider: z.string().optional(),
    selectedModel: z.string().optional(),
    selectedModelId: z.number().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
})

// Unified AI Query request schema (SUMR-compatible)
const aiQuerySchema = z.object({
    // Core parameters
    query: z.string(),
    message: z.string().optional(), // Alternative to query
    prompt: z.string().optional(), // Pre-built prompt

    // Provider & model selection
    provider: z.string().default('dbx-agent'), // dbx-agent, bedrock, openai, claude
    model: z.string().optional(), // Model name/ID
    model_id: z.union([z.string(), z.number()]).optional(),
    service_id: z.number().optional(), // SUMR compatibility (1=bedrock, 2=openai, etc.)

    // Connection & schema context
    connection_id: z.string().optional(),
    database_id: z.string().optional(),
    external_connection_id: z.string().optional(),
    schema: z.string().optional(), // Schema name or text
    schema_id: z.string().optional(), // Schema ID for metadata
    schema_table_ids: z.array(z.string()).optional(), // Specific tables
    tables: z.array(z.string()).optional(), // Table names
    database_name: z.string().optional(),

    // Vector search / embeddings
    is_embeddings_used: z.boolean().optional().default(false),
    k: z.number().optional().default(20), // Number of embedding results

    // Memory system
    session_id: z.string().optional(), // Chat session ID
    use_memory: z.boolean().optional().default(false),

    // LLM control
    temperature: z.number().optional().default(0.7),
    maxTokens: z.number().optional(), // Auto: 2000 simple, 5000 complex
    extra_context: z.string().optional(), // Additional context

    // Think mode
    force_model: z.string().optional(), // 'auto', 'simple', 'complex'
    use_thinking_mode: z.boolean().optional(), // Force think mode on/off

    // Credentials for non-server-side providers
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // Token refresh support
    refresh_token: z.string().optional(),
})

// AI Response type
interface AIResponse {
    success: boolean
    message?: string // Full response text
    sql?: string // Extracted SQL
    thinking?: string // Reasoning process (Think mode)
    error?: string
    complexity?: ComplexityAnalysis // Query complexity analysis
    routing?: {
        selectedAgent: string
        reason: string
    }
    session_id?: string
    memoryUsed?: boolean
}

// In-memory credentials storage
let storedCredentials: Record<string, string> = {}

// Main Server URL for DBX Agent
const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'https://fp9waphqm5.us-east-1.awsapprunner.com/api/v1'

// ==================== HELPER FUNCTIONS ====================

/**
 * Refresh expired auth token
 */
async function refreshAuthToken(refreshToken: string): Promise<string | null> {
    try {
        consola.info('🔄 Attempting to refresh expired token...')

        const response = await fetch(`${MAIN_SERVER_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            consola.error('❌ Token refresh failed:', errorData)
            return null
        }

        const data = await response.json() as { status?: string; token?: string }

        if (data.status === 'success' && data.token) {
            consola.info('✅ Token refreshed successfully')
            return data.token
        }

        consola.error('❌ Token refresh response invalid:', data)
        return null
    } catch (error) {
        consola.error('❌ Token refresh error:', error)
        return null
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
        // Check if it looks like SQL
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

// ==================== AI PROVIDER IMPLEMENTATIONS ====================

/**
 * Call OpenAI API
 */
async function callOpenAI(
    query: string,
    apiKey: string,
    model: string = 'gpt-4o-mini',
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        const systemPrompt = schemaContext
            ? `You are a SQL expert. Given the following database schema, generate SQL queries based on natural language requests.\n\nSchema:\n${schemaContext}\n\nGenerate only valid SQL queries. Do not include explanations unless asked.`
            : `You are a SQL expert. Generate SQL queries based on natural language requests. Generate only valid SQL queries. Do not include explanations unless asked.`

        const userPrompt = useThinking ? buildThinkingPrompt(query, schemaContext || '') : query

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } }
            throw new Error(errorData?.error?.message || `OpenAI API error: ${response.status}`)
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content || ''

        // Extract thinking and SQL if in thinking mode
        if (useThinking) {
            const { thinking, sql } = extractThinkingAndSQL(content)
            return {
                success: true,
                message: content,
                sql: sql || extractSQL(content) || undefined,
                thinking: thinking || undefined,
            }
        }

        // Extract SQL from response
        const sql = extractSQL(content)

        return {
            success: true,
            message: content,
            sql: sql || undefined,
        }
    } catch (error) {
        consola.error('OpenAI API error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'OpenAI API request failed',
        }
    }
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropicClaude(
    query: string,
    apiKey: string,
    model: string = 'claude-3-5-haiku-20241022',
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        const systemPrompt = schemaContext
            ? `You are a SQL expert. Given the following database schema, generate SQL queries based on natural language requests.\n\nSchema:\n${schemaContext}\n\nGenerate only valid SQL queries. Do not include explanations unless asked.`
            : `You are a SQL expert. Generate SQL queries based on natural language requests. Generate only valid SQL queries. Do not include explanations unless asked.`

        const userPrompt = useThinking ? buildThinkingPrompt(query, schemaContext || '') : query

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt },
                ],
            }),
        })

        if (!response.ok) {
            const errorData = await response.json() as { error?: { message?: string } }
            throw new Error(errorData?.error?.message || `Anthropic API error: ${response.status}`)
        }

        const data = await response.json() as { content?: Array<{ text?: string }> }
        const content = data.content?.[0]?.text || ''

        // Extract thinking and SQL if in thinking mode
        if (useThinking) {
            const { thinking, sql } = extractThinkingAndSQL(content)
            return {
                success: true,
                message: content,
                sql: sql || extractSQL(content) || undefined,
                thinking: thinking || undefined,
            }
        }

        // Extract SQL from response
        const sql = extractSQL(content)

        return {
            success: true,
            message: content,
            sql: sql || undefined,
        }
    } catch (error) {
        consola.error('Anthropic Claude API error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Anthropic API request failed',
        }
    }
}

/**
 * Call AWS Bedrock API (Fixed signature issue)
 */
async function callAWSBedrock(
    query: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string = 'us-east-1',
    model: string = 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    schemaContext?: string,
    useThinking: boolean = false
): Promise<AIResponse> {
    try {
        consola.info('🔧 AWS Bedrock Request:')
        consola.info(`  Model: ${model}`)
        consola.info(`  Region: ${region}`)

        const systemPrompt = schemaContext
            ? `You are a SQL expert. Given the following database schema, generate SQL queries based on natural language requests.\n\nSchema:\n${schemaContext}\n\nGenerate only valid SQL queries.`
            : `You are a SQL expert. Generate SQL queries based on natural language requests. Generate only valid SQL queries.`

        const userPrompt = useThinking ? buildThinkingPrompt(query, schemaContext || '') : query

        // Create AWS Bedrock client
        const client = new BedrockRuntimeClient({
            region,
            credentials: {
                accessKeyId: accessKeyId.trim(),
                secretAccessKey: secretAccessKey.trim(),
            },
        })

        // Create request body
        const requestBody = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt },
            ],
        }

        // Invoke model (AWS SDK handles encoding automatically)
        const command = new InvokeModelCommand({
            modelId: model, // Do NOT encode - SDK handles it
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody),
        })

        const response = await client.send(command)

        consola.info(`✅ AWS Bedrock response received`)

        // Parse response
        const responseBody = JSON.parse(new TextDecoder().decode(response.body))
        const content = responseBody.content?.[0]?.text || ''

        // Extract thinking and SQL if in thinking mode
        if (useThinking) {
            const { thinking, sql } = extractThinkingAndSQL(content)
            return {
                success: true,
                message: content,
                sql: sql || extractSQL(content) || undefined,
                thinking: thinking || undefined,
            }
        }

        // Extract SQL from response
        const sql = extractSQL(content)

        return {
            success: true,
            message: content,
            sql: sql || undefined,
        }
    } catch (error: any) {
        consola.error('❌ AWS Bedrock API error:', error.message)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'AWS Bedrock API request failed',
        }
    }
}

/**
 * Call DBX Agent (SUMR-compatible)
 */
async function callDBXAgent(
    query: string,
    authToken: string,
    modelNameOrId: string | number = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    schemaContext?: string,
    refreshToken?: string,
    useThinking: boolean = false,
    connectionId?: string,
    tables?: string[],
    schemaTableIds?: string[],
    schemaId?: string,
    databaseId?: string,
    externalConnectionId?: string,
    tools?: DatabaseTool[]
): Promise<AIResponse> {
    // Validate and sanitize model name
    let model_name = typeof modelNameOrId === 'string' ? modelNameOrId : 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'

    // If model_name is none/null/undefined, empty string, or the string 'None', use default model
    if (!model_name || model_name.trim() === '' || model_name.toLowerCase() === 'none') {
        model_name = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    }

    try {
        // Include schema context ahead of the user's query when provided
        const prompt = schemaContext
            ? `${schemaContext}\n\n${query}`
            : query

        // Build request body EXACTLY like SUMR
        const body: Record<string, unknown> = {
            prompt: prompt,
            model_id: model_name  // CRITICAL: Use model_id NOT model_name!
        }

        // Attach database context so the remote agent can build DB tools (matches sumr AI SQL client)
        if (connectionId) {
            body.connection_id = connectionId
        }

        if (externalConnectionId) {
            body.external_connection_id = externalConnectionId
        }

        if (databaseId) {
            body.database_id = databaseId
        }

        if (schemaId) {
            body.schema_id = schemaId
        }

        // Send table list when available (matches SSE flow in ai-stream)
        if (tables && tables.length > 0) {
            body.tables = tables
        }

        if (Array.isArray(schemaTableIds) && schemaTableIds.length > 0) {
            body.schema_table_ids = schemaTableIds
        }

        if (tools && tools.length > 0) {
            body.tools = tools
        }

        consola.info(`🚀 Calling DBX Multi-Service Inference${useThinking ? ' [THINK MODE]' : ''}`)
        consola.info(`   Model: ${model_name}`)
        consola.info(`   Prompt length: ${prompt.length} chars`)
        if (connectionId) consola.info(`   Connection ID: ${connectionId}`)
        if (tables?.length) consola.info(`   Tables: ${tables.slice(0, 10).join(', ')}${tables.length > 10 ? ` (+${tables.length - 10} more)` : ''}`)
        if (schemaTableIds?.length) consola.info(`   Schema table IDs: ${schemaTableIds.slice(0, 10).join(', ')}${schemaTableIds.length > 10 ? ` (+${schemaTableIds.length - 10} more)` : ''}`)
        if (tools?.length) consola.info(`   Tools: ${tools.map(t => t.name).join(', ')}`)

        // Make request with timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        let inferenceResponse = await fetch(`${MAIN_SERVER_URL}/llm-inference/dbx-multi-service-inference`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal
        })

        clearTimeout(timeout)

        consola.info(`📥 Response status: ${inferenceResponse.status}`)

        // Handle token expiry (401) and retry with refreshed token
        if (inferenceResponse.status === 401 && refreshToken) {
            consola.warn(`⚠️ Got 401, attempting token refresh...`)

            const newToken = await refreshAuthToken(refreshToken)

            if (newToken) {
                consola.info('✅ Token refreshed, retrying request...')

                // Retry with new token
                const retryTimeout = setTimeout(() => controller.abort(), 30000)
                inferenceResponse = await fetch(`${MAIN_SERVER_URL}/llm-inference/dbx-multi-service-inference`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${newToken}`,
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                })
                clearTimeout(retryTimeout)

                consola.info(`📥 Retry response status: ${inferenceResponse.status}`)
            } else {
                consola.error('❌ Token refresh failed')
                return {
                    success: false,
                    error: 'Token has expired and refresh failed. Please login again.'
                }
            }
        }

        // Check if request was successful
        if (!inferenceResponse.ok) {
            const errorText = await inferenceResponse.text().catch(() => 'Unknown error')
            consola.error(`❌ API error (${inferenceResponse.status}):`, errorText)
            throw new Error(`API error (${inferenceResponse.status}): ${errorText}`)
        }

        // Parse response - check multiple possible response formats
        const json = await inferenceResponse.json().catch(() => ({})) as {
            results?: Array<{ output?: string; model?: string }>
            output?: string
            text?: string
            result?: string
            content?: string | Array<{ text?: string }>
            response?: string
            message?: string
            answer?: string
            sql?: string
            thinking?: string
            status?: string
        }

        // Extract content from various possible response fields
        let inferredText = ''

        // Try different response formats
        if (json.results?.[0]?.output) {
            inferredText = json.results[0].output
        } else if (json.output) {
            inferredText = json.output
        } else if (json.text) {
            inferredText = json.text
        } else if (json.result) {
            inferredText = json.result
        } else if (typeof json.content === 'string') {
            inferredText = json.content
        } else if (Array.isArray(json.content) && json.content[0]?.text) {
            inferredText = json.content[0].text
        } else if (json.response) {
            inferredText = json.response
        } else if (json.message) {
            inferredText = json.message
        } else if (json.answer) {
            inferredText = json.answer
        } else {
            inferredText = JSON.stringify(json)
        }

        consola.info(`✅ Response received: ${inferredText.substring(0, 200)}...`)

        // Extract thinking and SQL if in thinking mode
        if (useThinking) {
            const { thinking, sql } = extractThinkingAndSQL(inferredText)
            return {
                success: true,
                message: inferredText,
                sql: sql || json.sql || extractSQL(inferredText) || undefined,
                thinking: thinking || json.thinking || undefined,
            }
        }

        // Extract SQL from response
        const sql = json.sql || extractSQL(inferredText)

        return {
            success: true,
            message: inferredText,
            sql: sql || undefined,
        }
    } catch (error) {
        consola.error('DBX Agent error:', error instanceof Error ? error.message : error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'DBX Agent request failed',
        }
    }
}

// ==================== ORPC ROUTES ====================

/**
 * Get AI credentials
 */
export const getCredentials = orpc
    .handler(async () => {
        return {
            success: true,
            status: 'success',
            credentials: {
                selectedProvider: storedCredentials.selectedProvider || 'dbx-agent',
                selectedModel: storedCredentials.selectedModel || '',
                selectedModelId: storedCredentials.selectedModelId || '801',
                AWS_ACCESS_KEY_ID: storedCredentials.AWS_ACCESS_KEY_ID ? '***configured***' : '',
                AWS_SECRET_ACCESS_KEY: storedCredentials.AWS_SECRET_ACCESS_KEY ? '***configured***' : '',
                AWS_REGION: storedCredentials.AWS_REGION || 'us-east-1',
                ANTHROPIC_API_KEY: storedCredentials.ANTHROPIC_API_KEY ? '***configured***' : '',
                OPENAI_API_KEY: storedCredentials.OPENAI_API_KEY ? '***configured***' : '',
            },
        }
    })

/**
 * Save AI credentials
 */
export const setCredentials = orpc
    .input(credentialsSchema)
    .handler(async ({ input }) => {
        if (input.selectedProvider) storedCredentials.selectedProvider = input.selectedProvider
        if (input.selectedModel) storedCredentials.selectedModel = input.selectedModel
        if (input.selectedModelId) storedCredentials.selectedModelId = String(input.selectedModelId)
        if (input.AWS_ACCESS_KEY_ID) storedCredentials.AWS_ACCESS_KEY_ID = input.AWS_ACCESS_KEY_ID
        if (input.AWS_SECRET_ACCESS_KEY) storedCredentials.AWS_SECRET_ACCESS_KEY = input.AWS_SECRET_ACCESS_KEY
        if (input.AWS_REGION) storedCredentials.AWS_REGION = input.AWS_REGION
        if (input.ANTHROPIC_API_KEY) storedCredentials.ANTHROPIC_API_KEY = input.ANTHROPIC_API_KEY
        if (input.OPENAI_API_KEY) storedCredentials.OPENAI_API_KEY = input.OPENAI_API_KEY

        consola.info('AI credentials updated for provider:', input.selectedProvider)

        return {
            success: true,
            status: 'success',
            message: 'Credentials saved successfully',
        }
    })

/**
 * Clear AI credentials
 */
export const clearCredentials = orpc
    .handler(async () => {
        storedCredentials = {}
        return {
            success: true,
            status: 'success',
            message: 'Credentials cleared',
        }
    })

/**
 * Unified AI Query API (SUMR-compatible with Think mode)
 */
export const query = orpc
    .input(aiQuerySchema)
    .handler(async ({ input, context }) => {
        consola.info('🚨 Unified AI Query Request:', {
            provider: input.provider,
            model: input.model,
            query: input.query?.substring(0, 50) + '...',
            useThinking: input.use_thinking_mode,
            forceModel: input.force_model,
        })

        const {
            query: userQuery,
            provider,
            model,
            schema,
            tables,
            connection_id,
            external_connection_id,
            schema_id,
            schema_table_ids,
            database_id,
            use_thinking_mode,
            force_model,
            extra_context,
        } = input

        // Step 1: Analyze query complexity
        const complexity = analyzeQueryComplexity(userQuery)

        // Step 2: Determine routing (simple vs complex model)
        const routing = determineRouting(complexity, force_model === 'auto' || force_model === undefined)

        // Step 3: Decide if we should use thinking mode
        const useThinking = use_thinking_mode !== undefined
            ? use_thinking_mode
            : routing.useThinkingMode

        consola.info(`📊 Complexity Analysis:`, complexity)
        consola.info(`🧭 Routing Decision:`, routing)
        consola.info(`🧠 Think Mode:`, useThinking ? 'ENABLED' : 'DISABLED')

        // Build schema context if provided
        let schemaContext: string | undefined
        if (schema) {
            schemaContext = `Schema: ${schema}`
            if (tables && tables.length > 0) {
                schemaContext += `\nTables: ${tables.join(', ')}`
            }
        }

        // Append any additional context from frontend (e.g., open table column info)
        const trimmedExtraContext = extra_context?.trim()
        if (trimmedExtraContext) {
            schemaContext = schemaContext
                ? `${schemaContext}\n\nAdditional context:\n${trimmedExtraContext}`
                : `Additional context:\n${trimmedExtraContext}`
        }

        // Track whether extra context is already captured in schemaContext to avoid duplication later
        const extraContextAlreadyInSchema = !!(trimmedExtraContext && schemaContext)

        // Route to appropriate provider
        let response: AIResponse

        switch (provider) {
            case 'openai': {
                const apiKey = input.OPENAI_API_KEY || storedCredentials.OPENAI_API_KEY
                if (!apiKey) {
                    return {
                        success: false,
                        error: 'OpenAI API key not configured.',
                    }
                }
                const modelName = model || 'gpt-4o-mini'
                response = await callOpenAI(userQuery, apiKey, modelName, schemaContext, useThinking)
                break
            }

            case 'claude': {
                const apiKey = input.ANTHROPIC_API_KEY || storedCredentials.ANTHROPIC_API_KEY
                if (!apiKey) {
                    return {
                        success: false,
                        error: 'Anthropic API key not configured.',
                    }
                }
                const modelName = model || 'claude-3-5-haiku-20241022'
                response = await callAnthropicClaude(userQuery, apiKey, modelName, schemaContext, useThinking)
                break
            }

            case 'bedrock': {
                const accessKeyId = input.AWS_ACCESS_KEY_ID || storedCredentials.AWS_ACCESS_KEY_ID
                const secretAccessKey = input.AWS_SECRET_ACCESS_KEY || storedCredentials.AWS_SECRET_ACCESS_KEY
                const region = input.AWS_REGION || storedCredentials.AWS_REGION || 'us-east-1'

                if (!accessKeyId || !secretAccessKey) {
                    return {
                        success: false,
                        error: 'AWS credentials not configured.',
                    }
                }
                const modelName = model || 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
                response = await callAWSBedrock(
                    userQuery,
                    accessKeyId,
                    secretAccessKey,
                    region,
                    modelName,
                    schemaContext,
                    useThinking
                )
                break
            }

            case 'dbx-agent':
            default: {
                // Extract auth token
                const authHeader = context?.headers?.get?.('authorization') || ''
                const token = authHeader.replace(/^Bearer\s+/i, '').trim()

                if (!token) {
                    return {
                        success: false,
                        error: 'Authentication required for DBX Agent.',
                    }
                }

                // Validate model name
                let modelName = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' // Default

                if (model && typeof model === 'string') {
                    const trimmedModel = model.trim()
                    if (trimmedModel !== '' &&
                        trimmedModel.toLowerCase() !== 'none' &&
                        trimmedModel.toLowerCase() !== 'null' &&
                        trimmedModel.toLowerCase() !== 'undefined') {
                        modelName = trimmedModel
                    }
                }

                // Get refresh token
                const refreshToken = input.refresh_token

                // Build enhanced prompt with schema if connection provided
                let enhancedPrompt = userQuery
                if (connection_id) {
                    try {
                        enhancedPrompt = await generateSQLPrompt(userQuery, connection_id, input.tables)
                        consola.info(`✨ Enhanced prompt with schema: ${enhancedPrompt.length} chars`)
                    } catch (error: any) {
                        consola.warn(`Failed to enhance prompt: ${error.message}`)
                    }
                }

                if (trimmedExtraContext && !extraContextAlreadyInSchema) {
                    enhancedPrompt = `${enhancedPrompt}\n\nAdditional context:\n${trimmedExtraContext}`
                }

                // Build DB tools for Postgres/sql connections (mirror SSE flow in ai-stream)
                let tools: DatabaseTool[] | undefined
                if (connection_id) {
                    tools = [createDatabaseQueryTool(connection_id), createSchemaInspectionTool()]
                    consola.info(`🔧 Attaching tools to DBX Agent request: ${tools.map(t => t.name).join(', ')}`)
                }

                response = await callDBXAgent(
                    enhancedPrompt,
                    token,
                    modelName,
                    schemaContext,
                    refreshToken,
                    useThinking,
                    connection_id,
                    tables,
                    schema_table_ids,
                    schema_id,
                    database_id,
                    external_connection_id,
                    tools
                )
                break
            }
        }

        // Add complexity and routing info to response
        return {
            ...response,
            complexity,
            routing: {
                selectedAgent: routing.useComplexModel ? 'complex' : 'simple',
                reason: routing.reason,
            },
        }
    })

// Export router
export const aiRouter = {
    // Credential management
    getCredentials,
    setCredentials,
    clearCredentials,
    // Query execution (legacy/direct)
    query,
}

// Re-export chat routes (Phase 5: Chat routes with session/message management)
export { chatRouter } from './chat'

// Export AI provider functions for use in chat routes (Phase 6)
export { callOpenAI, callAnthropicClaude, callAWSBedrock }
