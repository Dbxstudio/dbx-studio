import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toast } from 'sonner'

// Types
export interface QueryResult {
    success: boolean
    rows: unknown[]
    rowCount: number
    duration: number
}

export interface QueryHistory {
    id: string
    connectionId: string
    sql: string
    database?: string
    duration?: string
    rowCount?: string
    error?: string
    isSuccess: boolean
    isFavorite: boolean
    title?: string
    executedAt: Date
}

// Query Keys
export const queryKeys = {
    all: ['queries'] as const,
    history: (connectionId?: string) => [...queryKeys.all, 'history', connectionId] as const,
}

/**
 * Execute a SQL query
 */
export function useExecuteQuery() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: {
            connectionId: string
            sql: string
            saveToHistory?: boolean
            title?: string
        }) => {
            const result = await api.queries.execute(input)
            return result as QueryResult
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.history() })
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Query execution failed')
        },
    })
}

/**
 * Get query history
 */
export function useQueryHistory(connectionId?: string) {
    return useQuery({
        queryKey: queryKeys.history(connectionId),
        queryFn: async () => {
            const result = await api.queries.list({
                connectionId,
                limit: 50,
            })
            return result as QueryHistory[]
        },
    })
}

/**
 * Toggle favorite status
 */
export function useToggleFavorite() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.queries.toggleFavorite({ id })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.history() })
        },
    })
}

/**
 * Delete query from history
 */
export function useDeleteQuery() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            return await api.queries.remove({ id })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.history() })
        },
    })
}
