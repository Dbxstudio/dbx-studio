/**
 * AI Chat Routes - oRPC Implementation
 * Phase 5: Create oRPC AI chat routes (collection/context modes)
 * 
 * Features:
 * - Session management (create, get, list, delete)
 * - Message handling (send, stream, get history)
 * - Collection mode (chat with entire schema/collection)
 * - Context mode (chat with specific table context)
 * - Memory integration (STM/LTM)
 * - Vector search for relevant context
 */

import { z } from 'zod'
import { orpc, ORPCError } from '~/orpc'
import { db } from '~/drizzle'
import {
    aiSessions,
    aiConversations,
    aiLongTermMemories,
    schemaTables,
    schemas,
    databases,
    activeConnections
} from '~/drizzle/schema/ai-tables'
import { connections } from '~/drizzle/schema/connections'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import consola from 'consola'

// Import AI provider functions (with tool support)
import {
    callOpenAIWithTools,
    callAnthropicWithTools,
    callBedrockWithTools
} from './providersWithTools'

// Legacy imports for backward compatibility
import {
    callOpenAI,
    callAnthropicClaude,
    callAWSBedrock
} from './index'

// ==================== SCHEMAS ====================

// Chat Session Schemas
const createSessionSchema = z.object({
    connectionId: z.string(),
    sessionName: z.string().optional(),
    mode: z.enum(['collection', 'context']).default('collection'),
    // Context mode: specific table
    databaseName: z.string().optional(),
    schemaName: z.string().optional(),
    tableName: z.string().optional(),
    // Collection mode: entire schema or specific tables
    tables: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
})

const getSessionSchema = z.object({
    sessionId: z.string(),
})

const listSessionsSchema = z.object({
    connectionId: z.string().optional(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
})

const deleteSessionSchema = z.object({
    sessionId: z.string(),
})

const updateSessionSchema = z.object({
    sessionId: z.string(),
    sessionName: z.string().optional(),
    metadata: z.record(z.any()).optional(),
})

// Message Schemas
const sendMessageSchema = z.object({
    sessionId: z.string(),
    message: z.string(),
    // Optional context override
    databaseName: z.string().optional(),
    schemaName: z.string().optional(),
    tableName: z.string().optional(),
    tables: z.array(z.string()).optional(),
    // AI Parameters
    provider: z.string().optional().default('openai'),
    model: z.string().optional(),
    temperature: z.number().optional().default(0.7),
    maxTokens: z.number().optional(),
    useThinking: z.boolean().optional().default(false),
    // Tool calling
    useTools: z.boolean().optional().default(true), // Enable AI tools by default
    // Memory & Search
    useMemory: z.boolean().optional().default(true),
    useVectorSearch: z.boolean().optional().default(false),
    k: z.number().optional().default(20), // Vector search results
    // Credentials (optional override)
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
})

const getMessagesSchema = z.object({
    sessionId: z.string(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
})

const getMessageSchema = z.object({
    conversationId: z.string(),
})

// ==================== HELPERS ====================

/**
 * Build schema context from session configuration
 */
async function buildSchemaContext(
    connectionId: string,
    mode: 'collection' | 'context',
    databaseName?: string,
    schemaName?: string,
    tableName?: string,
    tables?: string[]
): Promise<{ context: string; schemaId?: number; tableIds?: number[] }> {
    try {
        // Get connection details
        const connection = await db.query.connections.findFirst({
            where: eq(connections.id, connectionId),
        })

        if (!connection) {
            throw new Error('Connection not found')
        }

        let context = `Database Type: ${connection.type}\n`
        let schemaId: number | undefined
        let tableIds: number[] = []

        if (mode === 'context' && tableName) {
            // Context mode: Single table
            const schemaRecord = await db.query.schemas.findFirst({
                where: and(
                    eq(schemas.schemaName, schemaName || 'public'),
                ),
            })

            if (schemaRecord) {
                schemaId = schemaRecord.id

                const tableRecord = await db.query.schemaTables.findFirst({
                    where: and(
                        eq(schemaTables.schemaId, schemaRecord.id),
                        eq(schemaTables.tableName, tableName)
                    ),
                })

                if (tableRecord) {
                    tableIds = [tableRecord.id]
                    context += `\nTable: ${tableName}`
                    if (tableRecord.aiDescription) {
                        context += `\nDescription: ${tableRecord.aiDescription}`
                    }
                    // TODO: Add column information from columnDescriptions table
                }
            }
        } else {
            // Collection mode: All or specific tables
            const schemaRecord = await db.query.schemas.findFirst({
                where: and(
                    eq(schemas.schemaName, schemaName || 'public'),
                ),
            })

            if (schemaRecord) {
                schemaId = schemaRecord.id

                let tableRecords
                if (tables && tables.length > 0) {
                    // Specific tables
                    tableRecords = await db.select()
                        .from(schemaTables)
                        .where(eq(schemaTables.schemaId, schemaRecord.id))
                        .limit(100)

                    tableRecords = tableRecords.filter(t => tables.includes(t.tableName))
                } else {
                    // All tables
                    tableRecords = await db.select()
                        .from(schemaTables)
                        .where(eq(schemaTables.schemaId, schemaRecord.id))
                        .limit(100)
                }

                tableIds = tableRecords.map(t => t.id)
                context += `\nSchema: ${schemaName || 'public'}`
                context += `\nTables: ${tableRecords.map(t => t.tableName).join(', ')}`
            }
        }

        return { context, schemaId, tableIds }
    } catch (error) {
        consola.error('Error building schema context:', error)
        return { context: '' }
    }
}

/**
 * Load conversation history for memory
 */
async function loadConversationHistory(
    sessionId: string,
    limit: number = 10
): Promise<any[]> {
    try {
        const conversations = await db.select()
            .from(aiConversations)
            .where(eq(aiConversations.sessionId, sessionId))
            .orderBy(desc(aiConversations.timestamp))
            .limit(limit)

        return conversations.map(conv => ({
            id: conv.id,
            messages: conv.messages ? JSON.parse(conv.messages) : [],
            timestamp: conv.timestamp,
        })).reverse() // Oldest first
    } catch (error) {
        consola.error('Error loading conversation history:', error)
        return []
    }
}

/**
 * Save conversation to database
 */
async function saveConversation(
    sessionId: string,
    messages: any[],
    databaseId?: number,
    schemaId?: number
): Promise<string> {
    try {
        const [conversation] = await db.insert(aiConversations)
            .values({
                id: nanoid(),
                sessionId,
                databaseId,
                schemaId,
                messages: JSON.stringify(messages),
                timestamp: new Date(),
            })
            .returning()

        // Update session last activity
        await db.update(aiSessions)
            .set({ lastActivity: new Date() })
            .where(eq(aiSessions.id, sessionId))

        return conversation.id
    } catch (error) {
        consola.error('Error saving conversation:', error)
        throw error
    }
}

// ==================== ROUTES ====================

/**
 * Create a new chat session
 */
export const createSession = orpc
    .input(createSessionSchema)
    .handler(async ({ input }) => {
        const {
            connectionId,
            sessionName,
            mode,
            databaseName,
            schemaName,
            tableName,
            tables,
            metadata,
        } = input

        try {
            // Verify connection exists
            const connection = await db.query.connections.findFirst({
                where: eq(connections.id, connectionId),
            })

            if (!connection) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Connection not found',
                })
            }

            // Get or create active connection
            let activeConnection = await db.query.activeConnections.findFirst({
                where: eq(activeConnections.connectionId, connectionId),
            })

            if (!activeConnection) {
                const [newActiveConnection] = await db.insert(activeConnections)
                    .values({
                        connectionId,
                    })
                    .returning()

                activeConnection = newActiveConnection
            }

            // Build context
            const { context, schemaId } = await buildSchemaContext(
                connectionId,
                mode,
                databaseName,
                schemaName,
                tableName,
                tables
            )

            // Create session
            const sessionId = nanoid()
            const [session] = await db.insert(aiSessions)
                .values({
                    id: sessionId,
                    activeConnectionId: activeConnection.id,
                    sessionName: sessionName || `${mode === 'context' ? tableName || 'Table' : 'Collection'} Chat`,
                    createdAt: new Date(),
                    lastActivity: new Date(),
                })
                .returning()

            consola.info(`✅ Created chat session: ${sessionId} (${mode} mode)`)

            return {
                success: true,
                session: {
                    id: session.id,
                    connectionId,
                    sessionName: session.sessionName,
                    mode,
                    context,
                    createdAt: session.createdAt,
                    lastActivity: session.lastActivity,
                    metadata: metadata || {},
                },
            }
        } catch (error) {
            consola.error('Error creating session:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to create session',
            })
        }
    })

/**
 * Get a specific session
 */
export const getSession = orpc
    .input(getSessionSchema)
    .handler(async ({ input }) => {
        const { sessionId } = input

        try {
            const session = await db.query.aiSessions.findFirst({
                where: eq(aiSessions.id, sessionId),
            })

            if (!session) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Session not found',
                })
            }

            // Get connection info (handle nullable activeConnectionId)
            let connectionId: string | undefined
            if (session.activeConnectionId !== null) {
                const activeConnection = await db.query.activeConnections.findFirst({
                    where: eq(activeConnections.id, session.activeConnectionId),
                })

                if (activeConnection?.connectionId) {
                    connectionId = activeConnection.connectionId
                }
            }

            return {
                success: true,
                session: {
                    id: session.id,
                    connectionId,
                    sessionName: session.sessionName,
                    createdAt: session.createdAt,
                    lastActivity: session.lastActivity,
                },
            }
        } catch (error) {
            if (error instanceof ORPCError) throw error

            consola.error('Error getting session:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to get session',
            })
        }
    })

/**
 * List all sessions (optionally filtered by connection)
 */
export const listSessions = orpc
    .input(listSessionsSchema)
    .handler(async ({ input }) => {
        const { connectionId, limit, offset } = input

        try {
            let sessions: any[] = []

            if (connectionId) {
                // Get active connection
                const activeConnection = await db.query.activeConnections.findFirst({
                    where: eq(activeConnections.connectionId, connectionId),
                })

                if (!activeConnection) {
                    return {
                        success: true,
                        sessions: [],
                        total: 0,
                    }
                }

                // Get sessions for this connection
                if (activeConnection.id !== null) {
                    sessions = await db.select()
                        .from(aiSessions)
                        .where(eq(aiSessions.activeConnectionId, activeConnection.id))
                        .orderBy(desc(aiSessions.lastActivity))
                        .limit(limit!)
                        .offset(offset!)
                } else {
                    sessions = []
                }
            } else {
                // Get all sessions
                sessions = await db.select()
                    .from(aiSessions)
                    .orderBy(desc(aiSessions.lastActivity))
                    .limit(limit!)
                    .offset(offset!)
            }

            return {
                success: true,
                sessions: sessions.map(s => ({
                    id: s.id,
                    sessionName: s.sessionName,
                    createdAt: s.createdAt,
                    lastActivity: s.lastActivity,
                })),
                total: sessions.length,
            }
        } catch (error) {
            consola.error('Error listing sessions:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to list sessions',
            })
        }
    })

/**
 * Delete a session and all its conversations
 */
export const deleteSession = orpc
    .input(deleteSessionSchema)
    .handler(async ({ input }) => {
        const { sessionId } = input

        try {
            // Check if session exists
            const session = await db.query.aiSessions.findFirst({
                where: eq(aiSessions.id, sessionId),
            })

            if (!session) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Session not found',
                })
            }

            // Delete session (cascade will delete conversations and memories)
            await db.delete(aiSessions)
                .where(eq(aiSessions.id, sessionId))

            consola.info(`✅ Deleted session: ${sessionId}`)

            return {
                success: true,
                message: 'Session deleted successfully',
            }
        } catch (error) {
            if (error instanceof ORPCError) throw error

            consola.error('Error deleting session:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to delete session',
            })
        }
    })

/**
 * Update session metadata
 */
export const updateSession = orpc
    .input(updateSessionSchema)
    .handler(async ({ input }) => {
        const { sessionId, sessionName, metadata } = input

        try {
            const session = await db.query.aiSessions.findFirst({
                where: eq(aiSessions.id, sessionId),
            })

            if (!session) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Session not found',
                })
            }

            // Update session
            const updates: any = {}
            if (sessionName !== undefined) updates.sessionName = sessionName

            await db.update(aiSessions)
                .set(updates)
                .where(eq(aiSessions.id, sessionId))

            return {
                success: true,
                message: 'Session updated successfully',
            }
        } catch (error) {
            if (error instanceof ORPCError) throw error

            consola.error('Error updating session:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to update session',
            })
        }
    })

/**
 * Send a message and get AI response
 * This is the main chat endpoint (non-streaming)
 * Supports: OpenAI, Anthropic Claude, AWS Bedrock
 */
export const sendMessage = orpc
    .input(sendMessageSchema)
    .handler(async ({ input, context }) => {
        const {
            sessionId,
            message,
            provider = 'openai',
            model,
            temperature = 0.7,
            maxTokens,
            useThinking = false,
            useMemory = true,
            databaseName,
            schemaName,
            tableName,
            tables,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY,
            AWS_REGION,
            ANTHROPIC_API_KEY,
            OPENAI_API_KEY,
        } = input

        try {
            // Get session
            const session = await db.query.aiSessions.findFirst({
                where: eq(aiSessions.id, sessionId),
            })

            if (!session) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Session not found',
                })
            }

            // Get connection (handle nullable activeConnectionId)
            if (session.activeConnectionId === null) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Connection not found for session',
                })
            }

            const activeConnection = await db.query.activeConnections.findFirst({
                where: eq(activeConnections.id, session.activeConnectionId),
            })

            if (!activeConnection?.connectionId) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Connection not found for session',
                })
            }

            const connectionId = activeConnection.connectionId

            // Build conversation history for memory
            let memoryContext = ''
            if (useMemory) {
                const conversationHistory = await loadConversationHistory(sessionId, 5)
                if (conversationHistory.length > 0) {
                    memoryContext = '\n\nPrevious conversation:\n' +
                        conversationHistory.map(conv => {
                            const msgs = conv.messages as any[]
                            return msgs.map(m => `${m.role}: ${m.content}`).join('\n')
                        }).join('\n')
                }
            }

            // Build schema context
            const { context: schemaContext, schemaId } = await buildSchemaContext(
                connectionId,
                tableName ? 'context' : 'collection',
                databaseName,
                schemaName,
                tableName,
                tables
            )

            // Build full context for AI
            const fullContext = schemaContext + memoryContext

            consola.info(`🤖 Calling AI provider: ${provider}`)
            consola.info(`📝 Message: ${message.substring(0, 100)}...`)
            consola.info(`🧠 Using memory: ${useMemory}`)
            consola.info(`💭 Think mode: ${useThinking}`)

            // Call appropriate AI provider
            let aiResponse: {
                success: boolean
                message?: string
                sql?: string
                thinking?: string
                error?: string
                toolCalls?: Array<{ tool: string; input: any; result: any }>
                chartConfig?: any
            }

            // Tool context for AI
            const toolContext = {
                connectionId: connectionId,
                schemaName: schemaName || 'public'
            }

            switch (provider) {
                case 'openai': {
                    const apiKey = OPENAI_API_KEY || process.env.OPENAI_API_KEY
                    if (!apiKey) {
                        throw new ORPCError('BAD_REQUEST', {
                            message: 'OpenAI API key not configured. Please provide OPENAI_API_KEY in the request or environment.',
                        })
                    }

                    const modelName = model || 'gpt-4o'

                    // Use tool-enabled function when useTools is true
                    if (input.useTools) {
                        aiResponse = await callOpenAIWithTools(
                            message,
                            apiKey,
                            modelName,
                            toolContext,
                            fullContext,
                            useThinking
                        )
                    } else {
                        aiResponse = await callOpenAI(
                            message,
                            apiKey,
                            modelName,
                            fullContext,
                            useThinking
                        )
                    }
                    break
                }

                case 'claude':
                case 'anthropic': {
                    const apiKey = ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
                    if (!apiKey) {
                        throw new ORPCError('BAD_REQUEST', {
                            message: 'Anthropic API key not configured. Please provide ANTHROPIC_API_KEY in the request or environment.',
                        })
                    }

                    const modelName = model || 'claude-3-5-sonnet-20241022'

                    // Use tool-enabled function when useTools is true
                    if (input.useTools) {
                        aiResponse = await callAnthropicWithTools(
                            message,
                            apiKey,
                            modelName,
                            toolContext,
                            fullContext,
                            useThinking
                        )
                    } else {
                        aiResponse = await callAnthropicClaude(
                            message,
                            apiKey,
                            modelName,
                            fullContext,
                            useThinking
                        )
                    }
                    break
                }

                case 'bedrock': {
                    const accessKeyId = AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
                    const secretAccessKey = AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
                    const region = AWS_REGION || process.env.AWS_REGION || 'us-east-1'

                    if (!accessKeyId || !secretAccessKey) {
                        throw new ORPCError('BAD_REQUEST', {
                            message: 'AWS credentials not configured. Please provide AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the request or environment.',
                        })
                    }

                    const modelName = model || 'us.anthropic.claude-3-5-sonnet-20241022-v1:0'

                    // Use tool-enabled function when useTools is true
                    if (input.useTools) {
                        aiResponse = await callBedrockWithTools(
                            message,
                            accessKeyId,
                            secretAccessKey,
                            region,
                            modelName,
                            toolContext,
                            fullContext,
                            useThinking
                        )
                    } else {
                        aiResponse = await callAWSBedrock(
                            message,
                            accessKeyId,
                            secretAccessKey,
                            region,
                            modelName,
                            fullContext,
                            useThinking
                        )
                    }
                    break
                }

                default: {
                    throw new ORPCError('BAD_REQUEST', {
                        message: `Unsupported AI provider: ${provider}. Supported providers: openai, claude, bedrock`,
                    })
                }
            }

            // Check if AI call was successful
            if (!aiResponse.success) {
                throw new ORPCError('INTERNAL_SERVER_ERROR', {
                    message: aiResponse.error || 'AI provider returned an error',
                })
            }

            consola.info(`✅ AI response received: ${aiResponse.message?.substring(0, 100)}...`)
            if (aiResponse.sql) {
                consola.info(`📊 SQL generated: ${aiResponse.sql.substring(0, 100)}...`)
            }

            // Save conversation
            const userMessage = {
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
            }

            const assistantMessage = {
                role: 'assistant',
                content: aiResponse.message || '',
                sql: aiResponse.sql,
                thinking: aiResponse.thinking,
                timestamp: new Date().toISOString(),
            }

            const conversationId = await saveConversation(
                sessionId,
                [userMessage, assistantMessage],
                undefined,
                schemaId
            )

            consola.info(`💾 Conversation saved: ${conversationId}`)

            return {
                success: true,
                conversationId,
                response: aiResponse.message || '',
                sql: aiResponse.sql,
                thinking: aiResponse.thinking,
                provider,
                model: model || 'default',
            }
        } catch (error) {
            if (error instanceof ORPCError) throw error

            consola.error('Error sending message:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to send message',
            })
        }
    })

/**
 * Get conversation history for a session
 */
export const getMessages = orpc
    .input(getMessagesSchema)
    .handler(async ({ input }) => {
        const { sessionId, limit, offset } = input

        try {
            const conversations = await db.select()
                .from(aiConversations)
                .where(eq(aiConversations.sessionId, sessionId))
                .orderBy(desc(aiConversations.timestamp))
                .limit(limit!)
                .offset(offset!)

            const messages = conversations.map(conv => ({
                id: conv.id,
                messages: conv.messages ? JSON.parse(conv.messages) : [],
                timestamp: conv.timestamp,
            }))

            return {
                success: true,
                messages: messages.reverse(), // Oldest first
                total: conversations.length,
            }
        } catch (error) {
            consola.error('Error getting messages:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to get messages',
            })
        }
    })

/**
 * Get a specific conversation/message
 */
export const getMessage = orpc
    .input(getMessageSchema)
    .handler(async ({ input }) => {
        const { conversationId } = input

        try {
            const conversation = await db.query.aiConversations.findFirst({
                where: eq(aiConversations.id, conversationId),
            })

            if (!conversation) {
                throw new ORPCError('NOT_FOUND', {
                    message: 'Conversation not found',
                })
            }

            return {
                success: true,
                conversation: {
                    id: conversation.id,
                    sessionId: conversation.sessionId,
                    messages: conversation.messages ? JSON.parse(conversation.messages) : [],
                    timestamp: conversation.timestamp,
                },
            }
        } catch (error) {
            if (error instanceof ORPCError) throw error

            consola.error('Error getting message:', error)
            throw new ORPCError('INTERNAL_SERVER_ERROR', {
                message: error instanceof Error ? error.message : 'Failed to get message',
            })
        }
    })

// Export chat router
export const chatRouter = {
    // Session management
    createSession,
    getSession,
    listSessions,
    deleteSession,
    updateSession,
    // Messaging
    sendMessage,
    getMessages,
    getMessage,
}
