/**
 * AI Chat Hooks - TanStack Query
 * Phase 8: Frontend State Management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orpcClient } from '@/shared/services/orpc-client'

// ==================== TYPES ====================

export type ChatMode = 'collection' | 'context'

export interface CreateSessionInput {
    connectionId: string
    sessionName?: string
    mode?: ChatMode
    databaseName?: string
    schemaName?: string
    tableName?: string
    tables?: string[]
}

export interface SendMessageInput {
    sessionId: string
    message: string
    provider?: string
    model?: string
    useMemory?: boolean
    useThinking?: boolean
}

// ==================== HOOKS ====================

/**
 * Create a new chat session
 */
export function useCreateSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateSessionInput) => {
            return await orpcClient.chat.createSession(input)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
        },
    })
}

/**
 * Get a specific session
 */
export function useSession(sessionId: string | undefined) {
    return useQuery({
        queryKey: ['chat', 'session', sessionId],
        queryFn: async () => {
            if (!sessionId) throw new Error('No session ID')
            return await orpcClient.chat.getSession({ sessionId })
        },
        enabled: !!sessionId,
    })
}

/**
 * List all sessions for a connection
 */
export function useSessions(connectionId?: string, limit = 50) {
    return useQuery({
        queryKey: ['chat', 'sessions', connectionId, limit],
        queryFn: async () => {
            return await orpcClient.chat.listSessions({ connectionId, limit, offset: 0 })
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
            return await orpcClient.chat.sendMessage(input)
        },
        onSuccess: (data, variables) => {
            // Invalidate messages for this session
            queryClient.invalidateQueries({
                queryKey: ['chat', 'messages', variables.sessionId]
            })
        },
    })
}

/**
 * Get messages for a session
 */
export function useMessages(sessionId: string | undefined, limit = 50) {
    return useQuery({
        queryKey: ['chat', 'messages', sessionId, limit],
        queryFn: async () => {
            if (!sessionId) throw new Error('No session ID')
            return await orpcClient.chat.getMessages({ sessionId, limit, offset: 0 })
        },
        enabled: !!sessionId,
        refetchInterval: 5000, // Auto-refresh every 5 seconds
    })
}

/**
 * Delete a session
 */
export function useDeleteSession() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (sessionId: string) => {
            return await orpcClient.chat.deleteSession({ sessionId })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
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
        }: {
            sessionId: string
            sessionName?: string
        }) => {
            return await orpcClient.chat.updateSession({ sessionId, sessionName })
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['chat', 'session', variables.sessionId]
            })
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] })
        },
    })
}
