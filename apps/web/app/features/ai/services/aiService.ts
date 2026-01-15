/**
 * AI Service
 * Handles communication with the backend server for AI features
 * Matches the sumr-ai-sql-client API structure
 * 
 * Supported Providers:
 * - DBX Agent (Server-side) - Default, uses server credentials
 * - AWS Bedrock - Anthropic Claude models on AWS
 * - OpenAI - GPT models
 * - Claude - Direct Anthropic API
 */

import { MODELS, getProviderById, getModelById, type Model } from './aiConfig'
import { getValidToken, authenticatedFetch } from '../../../shared/utils/authTokenManager'
import { api } from '../../../shared/services/api'

// Storage keys for AI credentials
const AI_STORAGE_KEYS = {
    SELECTED_PROVIDER: 'ai_selected_provider',
    SELECTED_MODEL: 'ai_selected_model',
    SELECTED_MODEL_ID: 'ai_selected_model_id',
    AWS_ACCESS_KEY_ID: 'ai_aws_access_key_id',
    AWS_SECRET_ACCESS_KEY: 'ai_aws_secret_access_key',
    AWS_REGION: 'ai_aws_region',
    ANTHROPIC_API_KEY: 'ai_anthropic_api_key',
    OPENAI_API_KEY: 'ai_openai_api_key',
}

export interface AICredentials {
    selectedProvider: string
    selectedModel?: string
    selectedModelId?: number
    AWS_ACCESS_KEY_ID?: string
    AWS_SECRET_ACCESS_KEY?: string
    AWS_REGION?: string
    ANTHROPIC_API_KEY?: string
    OPENAI_API_KEY?: string
}

export interface ChatResponse {
    success: boolean
    message?: string
    sql?: string
    explanation?: string
    error?: string
}

/**
 * Get auth token from authTokenManager
 * Uses getValidToken which automatically refreshes if expired
 */
async function getAuthTokenAsync(): Promise<string | null> {
    try {
        const result = await getValidToken()
        if (result.success && result.token) {
            return result.token
        }
        return null
    } catch {
        return null
    }
}

/**
 * Get auth token synchronously (for non-critical uses)
 * The token is stored under 'dbx_auth_token' key by the auth system
 */
function getAuthToken(): string | null {
    try {
        // First try the primary token key used by authTokenManager
        const token = localStorage.getItem('dbx_auth_token')
        if (token) {
            return token
        }

        // Fallback to legacy key for backwards compatibility
        const legacyToken = localStorage.getItem('auth_token')
        if (legacyToken) {
            try {
                const parsed = JSON.parse(legacyToken)
                return parsed.token || parsed
            } catch {
                return legacyToken
            }
        }
        return null
    } catch {
        return null
    }
}

class AIService {
    private currentProvider: string
    private currentModel: string
    private currentModelId: number
    private config: AICredentials

    constructor() {
        this.currentProvider = localStorage.getItem(AI_STORAGE_KEYS.SELECTED_PROVIDER) || 'dbx-agent'
        this.currentModelId = parseInt(localStorage.getItem(AI_STORAGE_KEYS.SELECTED_MODEL_ID) || '801', 10)

        // Get the stored model name, or look it up by ID, or use the default
        const storedModel = localStorage.getItem(AI_STORAGE_KEYS.SELECTED_MODEL)
        if (storedModel) {
            this.currentModel = storedModel
        } else {
            // Look up the model name by ID
            const model = MODELS.find(m => m.modelId === this.currentModelId)
            this.currentModel = model?.modelName || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
        }

        this.config = {
            selectedProvider: this.currentProvider,
            selectedModel: this.currentModel,
            selectedModelId: this.currentModelId,
            AWS_ACCESS_KEY_ID: (localStorage.getItem(AI_STORAGE_KEYS.AWS_ACCESS_KEY_ID) || '').trim(),
            AWS_SECRET_ACCESS_KEY: (localStorage.getItem(AI_STORAGE_KEYS.AWS_SECRET_ACCESS_KEY) || '').trim(),
            AWS_REGION: (localStorage.getItem(AI_STORAGE_KEYS.AWS_REGION) || 'us-east-1').trim(),
            ANTHROPIC_API_KEY: (localStorage.getItem(AI_STORAGE_KEYS.ANTHROPIC_API_KEY) || '').trim(),
            OPENAI_API_KEY: (localStorage.getItem(AI_STORAGE_KEYS.OPENAI_API_KEY) || '').trim(),
        }
    }

    /**
     * Get current configuration
     */
    getConfiguration(): { provider: string; model: string; modelId: number } {
        return {
            provider: this.currentProvider,
            model: this.currentModel,
            modelId: this.currentModelId
        }
    }

    /**
     * Update local configuration
     */
    updateConfiguration(config: Partial<AICredentials>): void {
        this.config = { ...this.config, ...config }

        if (config.selectedProvider) {
            this.currentProvider = config.selectedProvider
            localStorage.setItem(AI_STORAGE_KEYS.SELECTED_PROVIDER, config.selectedProvider)
        }
        if (config.selectedModel) {
            this.currentModel = config.selectedModel
            localStorage.setItem(AI_STORAGE_KEYS.SELECTED_MODEL, config.selectedModel)
        }
        if (config.selectedModelId !== undefined) {
            this.currentModelId = config.selectedModelId
            localStorage.setItem(AI_STORAGE_KEYS.SELECTED_MODEL_ID, String(config.selectedModelId))
        }

        // Also store credentials in localStorage (trim to prevent whitespace issues)
        if (config.AWS_ACCESS_KEY_ID !== undefined) {
            localStorage.setItem(AI_STORAGE_KEYS.AWS_ACCESS_KEY_ID, config.AWS_ACCESS_KEY_ID.trim())
        }
        if (config.AWS_SECRET_ACCESS_KEY !== undefined) {
            localStorage.setItem(AI_STORAGE_KEYS.AWS_SECRET_ACCESS_KEY, config.AWS_SECRET_ACCESS_KEY.trim())
        }
        if (config.AWS_REGION !== undefined) {
            localStorage.setItem(AI_STORAGE_KEYS.AWS_REGION, config.AWS_REGION.trim())
        }
        if (config.ANTHROPIC_API_KEY !== undefined) {
            localStorage.setItem(AI_STORAGE_KEYS.ANTHROPIC_API_KEY, config.ANTHROPIC_API_KEY.trim())
        }
        if (config.OPENAI_API_KEY !== undefined) {
            localStorage.setItem(AI_STORAGE_KEYS.OPENAI_API_KEY, config.OPENAI_API_KEY.trim())
        }

        console.log('AI Service configuration updated:', this.currentProvider, this.currentModelId)
    }

    /**
     * Set provider
     */
    setProvider(providerId: string): void {
        this.currentProvider = providerId
        this.config.selectedProvider = providerId
        localStorage.setItem(AI_STORAGE_KEYS.SELECTED_PROVIDER, providerId)
    }

    /**
     * Check if credentials are configured for current provider
     */
    hasCredentialsForProvider(provider: string = this.currentProvider): boolean {
        switch (provider) {
            case 'bedrock':
                return !!(this.config.AWS_ACCESS_KEY_ID && this.config.AWS_SECRET_ACCESS_KEY)
            case 'claude':
                return !!this.config.ANTHROPIC_API_KEY
            case 'openai':
                return !!this.config.OPENAI_API_KEY
            case 'dbx-agent':
                return true // No credentials required - uses server
            default:
                return false
        }
    }

    /**
     * Save credentials to backend server and localStorage
     */
    async setCredentials(credentials: AICredentials): Promise<{ success: boolean; error?: string }> {
        try {
            // Update local config first
            this.updateConfiguration(credentials)

            // Build payload for backend
            const payload: {
                selectedProvider?: string
                selectedModel?: string
                selectedModelId?: number
                AWS_ACCESS_KEY_ID?: string
                AWS_SECRET_ACCESS_KEY?: string
                AWS_REGION?: string
                ANTHROPIC_API_KEY?: string
                OPENAI_API_KEY?: string
            } = {
                selectedProvider: credentials.selectedProvider,
                selectedModel: credentials.selectedModel,
                selectedModelId: credentials.selectedModelId,
            }

            // Add provider-specific credentials
            if (credentials.selectedProvider === 'bedrock') {
                payload.AWS_ACCESS_KEY_ID = credentials.AWS_ACCESS_KEY_ID
                payload.AWS_SECRET_ACCESS_KEY = credentials.AWS_SECRET_ACCESS_KEY
                payload.AWS_REGION = credentials.AWS_REGION
            } else if (credentials.selectedProvider === 'claude') {
                payload.ANTHROPIC_API_KEY = credentials.ANTHROPIC_API_KEY
            } else if (credentials.selectedProvider === 'openai') {
                payload.OPENAI_API_KEY = credentials.OPENAI_API_KEY
            }

            // Call backend RPC endpoint using oRPC client
            try {
                await api.ai.setCredentials(payload)
                console.log('✅ AI credentials saved to backend')
            } catch (rpcError) {
                console.warn('Failed to save credentials to backend:', rpcError)
                // Continue - local save still worked
            }

            return { success: true }
        } catch (error) {
            console.error('Failed to save AI credentials:', error)
            // Still return success since local save worked
            return { success: true }
        }
    }

    /**
     * Get saved credentials from localStorage
     */
    getCredentials(): AICredentials {
        return { ...this.config }
    }

    /**
     * Send a chat message to the AI
     * Routes to the appropriate provider based on configuration
     */
    async sendMessage(
        message: string,
        context?: {
            connectionId?: string
            externalConnectionId?: string // Server-side connection ID for AI
            schema?: string
            tables?: string[]
            databaseName?: string
            tableDetails?: {
                tableName: string
                schema?: string
                columns?: Array<{ name: string; type?: string; nullable?: boolean; isPrimaryKey?: boolean }>
                sampleRows?: Array<Record<string, any>>
            }
        }
    ): Promise<ChatResponse> {
        try {
            // Check credentials for providers that require them
            if (!this.hasCredentialsForProvider()) {
                return {
                    success: false,
                    error: `${this.currentProvider} requires API credentials. Please configure them in settings.`
                }
            }

            const provider = getProviderById(this.currentProvider)
            const model = MODELS.find(m => m.modelId === this.currentModelId)

            // Determine which endpoint to use based on provider
            const isServerSideProvider = this.currentProvider === 'dbx-agent'

            // Ensure we have a valid model name - default to DBX Agent default model if not found
            // IMPORTANT: Avoid sending 'None', 'null', or 'undefined' as model name
            let modelName = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' // Default fallback
            
            if (model?.modelName && typeof model.modelName === 'string' && model.modelName.trim() !== '') {
                modelName = model.modelName
                console.log(`✅ Using model from MODELS array: ${modelName}`)
            } else if (this.currentModel && typeof this.currentModel === 'string' && this.currentModel.trim() !== '') {
                modelName = this.currentModel
                console.log(`✅ Using currentModel: ${modelName}`)
            } else {
                console.warn(`⚠️ No valid model found, using default: ${modelName}`)
                console.warn(`   - model?.modelName: ${model?.modelName}`)
                console.warn(`   - this.currentModel: ${this.currentModel}`)
                console.warn(`   - this.currentModelId: ${this.currentModelId}`)
            }
            
            const modelId = this.currentModelId || 801

            // Build payload - different formats for different endpoints
            const payload: Record<string, unknown> = {
                query: message,
                message,
                prompt: message, // Remote server expects 'prompt' field
                provider: this.currentProvider,
                model: modelName, // Always a valid model name string
                // model_id must ALWAYS be a number for the oRPC schema
                // The backend will use the 'model' field (string) for DBX Agent
                model_id: modelId,
                service_id: provider?.serviceId || 8,
            }

            // Add context if provided
            if (context) {
                if (context.connectionId) {
                    payload.connection_id = context.connectionId
                }
                if (context.externalConnectionId) {
                    payload.external_connection_id = context.externalConnectionId
                }
                if (context.schema) {
                    payload.schema = context.schema
                }
                if (context.tables) {
                    payload.tables = context.tables
                }
                if (context.databaseName) {
                    payload.database_name = context.databaseName
                }

                // Provide richer context about the currently open table (columns + sample rows)
                if (context.tableDetails) {
                    const { tableName, schema: tableSchema, columns, sampleRows } = context.tableDetails
                    const columnLines = (columns || []).map(c => `- ${c.name}${c.type ? ` (${c.type})` : ''}${c.isPrimaryKey ? ' [PK]' : ''}${c.nullable === false ? ' NOT NULL' : ''}`)
                    const sampleRowsText = (sampleRows || []).slice(0, 3).map(r => JSON.stringify(r)).join('\n')

                    const extraParts = [
                        `Open table: ${tableSchema ? `${tableSchema}.` : ''}${tableName}`,
                        columnLines.length ? `Columns:\n${columnLines.join('\n')}` : undefined,
                        sampleRowsText ? `Sample rows:\n${sampleRowsText}` : undefined,
                    ].filter(Boolean)

                    if (extraParts.length) {
                        payload.extra_context = extraParts.join('\n\n')
                    }
                }
            }

            // Add credentials for non-DBX-Agent providers
            if (!isServerSideProvider) {
                if (this.currentProvider === 'bedrock') {
                    payload.AWS_ACCESS_KEY_ID = this.config.AWS_ACCESS_KEY_ID
                    payload.AWS_SECRET_ACCESS_KEY = this.config.AWS_SECRET_ACCESS_KEY
                    payload.AWS_REGION = this.config.AWS_REGION
                } else if (this.currentProvider === 'claude') {
                    payload.ANTHROPIC_API_KEY = this.config.ANTHROPIC_API_KEY
                } else if (this.currentProvider === 'openai') {
                    payload.OPENAI_API_KEY = this.config.OPENAI_API_KEY
                }
            } else {
                // For DBX Agent, include refresh token for automatic token refresh
                const refreshToken = localStorage.getItem('dbx_refresh_token')
                if (refreshToken) {
                    payload.refresh_token = refreshToken
                    console.log('🔑 Including refresh token for automatic token refresh')
                }
            }

            // All providers now go through local backend using oRPC client
            // The local backend will proxy DBX Agent requests to the main server
            let response: Response

            console.log('📤 Sending AI request via oRPC to local backend')
            console.log('📤 Provider:', this.currentProvider)
            console.log('📤 Model Name:', modelName)
            console.log('📤 Model ID:', modelId)
            console.log('📤 Payload:', JSON.stringify(payload, null, 2))

            try {
                const result = await api.ai.query(payload as any)
                // Convert oRPC response to fetch Response format for consistency
                response = new Response(JSON.stringify(result), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            } catch (rpcError) {
                // Handle oRPC errors
                console.error('oRPC error:', rpcError)
                const errorMessage = rpcError instanceof Error ? rpcError.message : 'RPC request failed'
                response = new Response(JSON.stringify({
                    success: false,
                    error: errorMessage
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (!response.ok) {
                const errorText = await response.text().catch(() => '')
                let errorMessage = `AI request failed (${response.status})`

                try {
                    const error = JSON.parse(errorText)
                    // Handle array error details (common in FastAPI validation errors)
                    if (Array.isArray(error.detail)) {
                        errorMessage = error.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
                    } else {
                        errorMessage = error.detail || error.message || error.error || errorMessage
                    }
                } catch {
                    if (errorText.includes('Not Found') || response.status === 404) {
                        errorMessage = `API endpoint not found. Please check if the backend server is running.`
                    } else if (errorText) {
                        errorMessage = errorText.substring(0, 200)
                    }
                }

                console.error('AI request failed:', { status: response.status, errorMessage })
                return {
                    success: false,
                    error: errorMessage
                }
            }

            const data = await response.json()
            console.log('📥 AI response received:', data)

            // oRPC client already unwraps the response, but for DBX Agent (fetch response)
            // we need to check for wrapping. The oRPC server wraps in 'json' key
            const responseData = data.json || data

            // Check for error response from backend
            if (responseData.success === false) {
                return {
                    success: false,
                    error: responseData.error || responseData.message || 'AI request failed'
                }
            }

            // Parse response - handle different response formats
            let responseMessage = ''
            let sql = ''

            if (responseData.status === 'success' || responseData.success) {
                responseMessage = responseData.response || responseData.message || responseData.explanation || ''
                sql = responseData.sql || responseData.query || ''
            } else if (responseData.response) {
                responseMessage = responseData.response
                sql = responseData.sql || responseData.query || ''
            } else if (responseData.message) {
                responseMessage = responseData.message
                sql = responseData.sql || ''
            } else if (typeof responseData === 'string') {
                responseMessage = responseData
            }

            // Extract SQL from message if not provided directly
            if (!sql && responseMessage) {
                sql = this.extractSQL(responseMessage) || ''
            }

            return {
                success: true,
                message: responseMessage,
                sql: sql || undefined,
                explanation: responseData.explanation
            }
        } catch (error) {
            console.error('AI chat error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'AI request failed. Please try again.'
            }
        }
    }

    /**
     * Extract SQL from text response
     */
    private extractSQL(text: string): string | null {
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

    /**
     * Generate SQL from natural language (convenience method)
     */
    async generateSQL(
        prompt: string,
        context?: {
            connectionId?: string
            schema?: string
            tables?: Array<{ name: string; columns?: string[] }>
        }
    ): Promise<{ success: boolean; sql?: string; explanation?: string; error?: string }> {
        const result = await this.sendMessage(prompt, {
            connectionId: context?.connectionId,
            schema: context?.schema,
            tables: context?.tables?.map(t => t.name),
        })

        return {
            success: result.success,
            sql: result.sql,
            explanation: result.explanation || result.message,
            error: result.error
        }
    }

    /**
     * Streaming event types for tool display
     */
    static StreamEventTypes = {
        CHUNK: 'chunk',
        TOOL_CALL: 'tool_call',
        TOOL_RESPONSE: 'tool_response',
        DONE: 'done',
        ERROR: 'error',
        HEARTBEAT: 'heartbeat',
        TOOLS: 'tools',
    } as const

    /**
     * Send a message with streaming support and tool call events
     */
    async sendMessageStreaming(
        message: string,
        callbacks: {
            onChunk: (chunk: string) => void
            onToolCall: (toolName: string, args?: Record<string, unknown>) => void
            onToolResponse: (toolName: string, success: boolean, response?: string) => void
            onComplete: (fullMessage: string, sql?: string) => void
            onError: (error: string) => void
        },
        context?: {
            connectionId?: string
            externalConnectionId?: string
            schema?: string
            tables?: string[]
            databaseName?: string
            tableDetails?: {
                tableName: string
                schema?: string
                columns?: Array<{ name: string; type?: string; nullable?: boolean; isPrimaryKey?: boolean }>
                sampleRows?: Array<Record<string, unknown>>
            }
        }
    ): Promise<void> {
        const { onChunk, onToolCall, onToolResponse, onComplete, onError } = callbacks

        try {
            const token = await getAuthTokenAsync()
            if (!token) {
                onError('Authentication required')
                return
            }

            let enhancedMessage = message
            if (context?.tableDetails) {
                const { tableName, schema: tableSchema, columns, sampleRows } = context.tableDetails
                const columnLines = (columns || []).map(c => `- ${c.name}${c.type ? ` (${c.type})` : ''}${c.isPrimaryKey ? ' [PK]' : ''}${c.nullable === false ? ' NOT NULL' : ''}`)
                const sampleRowsText = (sampleRows || []).slice(0, 3).map(r => JSON.stringify(r)).join('\n')

                const extraParts = [
                    `Open table: ${tableSchema ? `${tableSchema}.` : ''}${tableName}`,
                    columnLines.length ? `Columns:\n${columnLines.join('\n')}` : undefined,
                    sampleRowsText ? `Sample rows:\n${sampleRowsText}` : undefined,
                ].filter(Boolean)

                if (extraParts.length) {
                    enhancedMessage = `${message}\n\nAdditional context:\n${extraParts.join('\n\n')}`
                }
            }

            const requestBody: Record<string, unknown> = {
                query: enhancedMessage,
                provider: this.currentProvider,
                model: this.currentModel,
            }

            if (context?.connectionId) requestBody.connection_id = context.connectionId
            if (context?.externalConnectionId) requestBody.external_connection_id = context.externalConnectionId
            if (context?.schema) requestBody.schema = context.schema
            if (context?.tables) requestBody.tables = context.tables
            if (context?.databaseName) requestBody.database = context.databaseName

            if (this.currentProvider === 'bedrock') {
                requestBody.AWS_ACCESS_KEY_ID = this.config.AWS_ACCESS_KEY_ID
                requestBody.AWS_SECRET_ACCESS_KEY = this.config.AWS_SECRET_ACCESS_KEY
                requestBody.AWS_REGION = this.config.AWS_REGION
            } else if (this.currentProvider === 'claude') {
                requestBody.ANTHROPIC_API_KEY = this.config.ANTHROPIC_API_KEY
            } else if (this.currentProvider === 'openai') {
                requestBody.OPENAI_API_KEY = this.config.OPENAI_API_KEY
            }

            console.log('📤 Starting streaming request with tool support...')
            console.log('📤 Provider:', this.currentProvider)
            console.log('📤 Model:', this.currentModel)

            const response = await fetch('/api/ai/query-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('❌ Streaming request failed:', response.status, errorText)
                onError(`Streaming failed (${response.status}): ${errorText || 'No error details'}`)
                return
            }

            if (!response.body) {
                onError('No response body')
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullMessage = ''
            let extractedSQL: string | undefined

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim()
                        if (dataStr === '[DONE]') continue

                        try {
                            const data = JSON.parse(dataStr)

                            if (data.type === 'chunk' || data.type === 'message') {
                                // Text content chunk
                                const content = data.content?.delta?.text || data.content?.text || data.content
                                if (typeof content === 'string' && content) {
                                    fullMessage += content
                                    onChunk(content)
                                }
                            } else if (data.type === 'tool_call') {
                                // Tool is being called
                                console.log('🔧 Tool call:', data.toolName, data.args)
                                onToolCall(data.toolName, data.args)
                            } else if (data.type === 'tool_response') {
                                // Tool completed
                                console.log('✅ Tool response:', data.toolName, data.success)
                                onToolResponse(data.toolName, data.success, data.response)
                            } else if (data.type === 'tools') {
                                // Initial tools list
                                console.log('🛠️ Available tools:', data.tools)
                            } else if (data.type === 'done') {
                                // Streaming complete
                                if (!extractedSQL) {
                                    extractedSQL = this.extractSQL(fullMessage) || undefined
                                }
                                onComplete(fullMessage, extractedSQL)
                            } else if (data.type === 'error') {
                                onError(data.error || 'Unknown error')
                                return
                            } else if (data.type === 'heartbeat') {
                                // Keep-alive, ignore
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', dataStr)
                        }
                    }
                }
            }

            // If we didn't get a 'done' event but stream ended, call complete
            if (fullMessage) {
                if (!extractedSQL) {
                    extractedSQL = this.extractSQL(fullMessage) || undefined
                }
                onComplete(fullMessage, extractedSQL)
            }
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Streaming request failed')
        }
    }
}

// Singleton instance
const aiService = new AIService()
export default aiService
