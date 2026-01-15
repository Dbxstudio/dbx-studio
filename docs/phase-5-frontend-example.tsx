/**
 * Phase 5: AI Chat Routes - Frontend Integration Example
 * 
 * This file demonstrates how to use the chat routes from the frontend
 * using TanStack Query hooks and the oRPC client.
 * 
 * NOTE: This is an example for Phase 7-10 implementation.
 * The actual hooks should be created in the frontend package.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { client } from '@/lib/orpc-client' // Your oRPC client instance

// ==================== TYPES ====================

type ChatMode = 'collection' | 'context'

interface CreateSessionInput {
    connectionId: string
    sessionName?: string
    mode?: ChatMode
    databaseName?: string
    schemaName?: string
    tableName?: string
    tables?: string[]
    metadata?: Record<string, any>
}

interface SendMessageInput {
    sessionId: string
    message: string
    provider?: string
    model?: string
    temperature?: number
    useThinking?: boolean
    useMemory?: boolean
}

// ==================== HOOKS ====================

/**
 * Create a new chat session
 */
export function useCreateSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateSessionInput) => {
            return await client.chat.createSession(input)
        },
        onSuccess: (data) => {
            // Invalidate sessions list to refresh
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })

            console.log('Session created:', data.session.id)
        },
        onError: (error) => {
            console.error('Failed to create session:', error)
        },
    })
}

/**
 * Get a specific session
 */
export function useSession(sessionId: string) {
    return useQuery({
        queryKey: ['chat', 'session', sessionId],
        queryFn: async () => {
            return await client.chat.getSession({ sessionId })
        },
        enabled: !!sessionId,
    })
}

/**
 * List all sessions for a connection
 */
export function useSessions(connectionId?: string, limit = 50, offset = 0) {
    return useQuery({
        queryKey: ['chat', 'sessions', connectionId, limit, offset],
        queryFn: async () => {
            return await client.chat.listSessions({ connectionId, limit, offset })
        },
    })
}

/**
 * Send a message in a session
 */
export function useSendMessage() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: SendMessageInput) => {
            return await client.chat.sendMessage(input)
        },
        onSuccess: (data, variables) => {
            // Invalidate messages for this session
            queryClient.invalidateQueries({
                queryKey: ['chat', 'messages', variables.sessionId]
            })

            // Update session last activity
            queryClient.invalidateQueries({
                queryKey: ['chat', 'session', variables.sessionId]
            })

            console.log('Message sent:', data.conversationId)
        },
        onError: (error) => {
            console.error('Failed to send message:', error)
        },
    })
}

/**
 * Get messages for a session
 */
export function useMessages(sessionId: string, limit = 50, offset = 0) {
    return useQuery({
        queryKey: ['chat', 'messages', sessionId, limit, offset],
        queryFn: async () => {
            return await client.chat.getMessages({ sessionId, limit, offset })
        },
        enabled: !!sessionId,
        // Refetch on focus to get new messages
        refetchOnWindowFocus: true,
    })
}

/**
 * Delete a session
 */
export function useDeleteSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return await client.chat.deleteSession({ sessionId })
        },
        onSuccess: () => {
            // Invalidate sessions list
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
        },
        onError: (error) => {
            console.error('Failed to delete session:', error)
        },
    })
}

/**
 * Update session metadata
 */
export function useUpdateSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            sessionId,
            sessionName,
            metadata,
        }: {
            sessionId: string
            sessionName?: string
            metadata?: Record<string, any>
        }) => {
            return await client.chat.updateSession({ sessionId, sessionName, metadata })
        },
        onSuccess: (data, variables) => {
            // Invalidate this session
            queryClient.invalidateQueries({
                queryKey: ['chat', 'session', variables.sessionId]
            })

            // Invalidate sessions list
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
        },
    })
}

// ==================== USAGE EXAMPLES ====================

/**
 * Example: Full chat flow in a React component
 */
export function ChatExample() {
    const [currentSessionId, setCurrentSessionId] = React.useState<string>()
    const [messageInput, setMessageInput] = React.useState('')

    // Hooks
    const createSession = useCreateSession()
    const sendMessage = useSendMessage()
    const { data: sessions } = useSessions('conn_123')
    const { data: messages } = useMessages(currentSessionId || '', 50, 0)
    const deleteSession = useDeleteSession()

    // Create new session
    const handleCreateSession = async () => {
        const result = await createSession.mutateAsync({
            connectionId: 'conn_123',
            mode: 'collection',
            sessionName: 'My Chat Session',
            tables: ['users', 'orders']
        })

        if (result.success) {
            setCurrentSessionId(result.session.id)
        }
    }

    // Send message
    const handleSendMessage = async () => {
        if (!currentSessionId || !messageInput.trim()) return

        const result = await sendMessage.mutateAsync({
            sessionId: currentSessionId,
            message: messageInput,
            provider: 'dbx-agent',
            useMemory: true,
        })

        if (result.success) {
            console.log('SQL:', result.sql)
            console.log('Response:', result.response)
            setMessageInput('')
        }
    }

    // Delete session
    const handleDeleteSession = async (sessionId: string) => {
        await deleteSession.mutateAsync(sessionId)
    }

    return (
        <div>
            <h1>Chat Example</h1>

            {/* Session List */}
            <div>
                <h2>Sessions</h2>
                <button onClick={handleCreateSession}>Create New Session</button>
                {sessions?.sessions.map(session => (
                    <div key={session.id}>
                        <button onClick={() => setCurrentSessionId(session.id)}>
                            {session.sessionName || 'Unnamed Session'}
                        </button>
                        <button onClick={() => handleDeleteSession(session.id)}>
                            Delete
                        </button>
                    </div>
                ))}
            </div>

            {/* Chat Messages */}
            {currentSessionId && (
                <div>
                    <h2>Messages</h2>
                    {messages?.messages.map(conv => (
                        <div key={conv.id}>
                            {conv.messages.map((msg, i) => (
                                <div key={i} className={msg.role}>
                                    <strong>{msg.role}:</strong> {msg.content}
                                    {msg.sql && <pre>{msg.sql}</pre>}
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Message Input */}
                    <div>
                        <input
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder="Ask a question..."
                        />
                        <button onClick={handleSendMessage}>
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ==================== ADVANCED PATTERNS ====================

/**
 * Custom hook for optimistic updates
 */
export function useOptimisticMessage() {
    const queryClient = useQueryClient()
    const sendMessage = useSendMessage()

    return {
        sendMessage: async (input: SendMessageInput) => {
            // Optimistically add user message
            queryClient.setQueryData(
                ['chat', 'messages', input.sessionId],
                (old: any) => {
                    if (!old) return old
                    return {
                        ...old,
                        messages: [
                            ...old.messages,
                            {
                                id: 'temp',
                                messages: [
                                    {
                                        role: 'user',
                                        content: input.message,
                                        timestamp: new Date().toISOString(),
                                    },
                                ],
                                timestamp: new Date(),
                            },
                        ],
                    }
                }
            )

            // Send actual message
            try {
                const result = await sendMessage.mutateAsync(input)
                return result
            } catch (error) {
                // Rollback on error
                queryClient.invalidateQueries({
                    queryKey: ['chat', 'messages', input.sessionId]
                })
                throw error
            }
        },
    }
}

/**
 * Hook for paginated message loading
 */
export function useInfiniteMessages(sessionId: string) {
    return useInfiniteQuery({
        queryKey: ['chat', 'messages', sessionId, 'infinite'],
        queryFn: async ({ pageParam = 0 }) => {
            return await client.chat.getMessages({
                sessionId,
                limit: 20,
                offset: pageParam,
            })
        },
        getNextPageParam: (lastPage, pages) => {
            const loadedCount = pages.reduce((sum, page) => sum + page.messages.length, 0)
            return loadedCount < lastPage.total ? loadedCount : undefined
        },
        enabled: !!sessionId,
    })
}

/**
 * Hook for auto-refreshing messages
 */
export function useAutoRefreshMessages(sessionId: string, intervalMs = 5000) {
    return useQuery({
        queryKey: ['chat', 'messages', sessionId],
        queryFn: async () => {
            return await client.chat.getMessages({ sessionId })
        },
        enabled: !!sessionId,
        refetchInterval: intervalMs,
        refetchIntervalInBackground: false,
    })
}

// ==================== UTILITIES ====================

/**
 * Helper to format messages for display
 */
export function formatMessages(messages: any[]) {
    return messages.flatMap(conv =>
        conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            isUser: msg.role === 'user',
        }))
    )
}

/**
 * Helper to check if session has activity
 */
export function isSessionActive(lastActivity: Date, thresholdMinutes = 30) {
    const now = new Date()
    const diff = now.getTime() - new Date(lastActivity).getTime()
    return diff < thresholdMinutes * 60 * 1000
}

/**
 * Helper to generate session name from mode and context
 */
export function generateSessionName(mode: ChatMode, tableName?: string, tables?: string[]) {
    if (mode === 'context' && tableName) {
        return `Chat: ${tableName}`
    }
    if (mode === 'collection' && tables && tables.length > 0) {
        return `Chat: ${tables.slice(0, 3).join(', ')}${tables.length > 3 ? '...' : ''}`
    }
    return 'New Chat Session'
}
