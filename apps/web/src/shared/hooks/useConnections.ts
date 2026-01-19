import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toast } from 'sonner'
import { authenticatedFetch } from '../utils/authTokenManager'
import { MAIN_SERVER_ENDPOINT } from '../constants/serverConfig'

// Types
export interface Connection {
    id: string
    name: string
    type: 'postgresql' | 'mysql' | 'mssql' | 'clickhouse' | 'snowflake'
    userId?: string
    host?: string
    port?: number
    database?: string
    username?: string
    ssl?: boolean
    account?: string
    warehouse?: string
    role?: string
    label?: string
    color?: string
    lastConnectedAt?: Date | null
    isActive?: boolean
    createdAt?: Date
    updatedAt?: Date
    externalConnectionId?: string // Server-side connection ID for AI queries
}

export interface CreateConnectionInput {
    name: string
    type: Connection['type']
    userId?: string
    host?: string
    port?: number
    database?: string
    username?: string
    password?: string
    ssl?: boolean
    account?: string
    warehouse?: string
    role?: string
    label?: string
    color?: string
}

// Query Keys
export const connectionKeys = {
    all: ['connections'] as const,
    list: (userId?: string) => [...connectionKeys.all, 'list', userId] as const,
    detail: (id: string) => [...connectionKeys.all, 'detail', id] as const,
}

// Helper to extract data from oRPC response
function extractData<T>(result: any): T {
    // oRPC with superjson returns { json: data, meta: [...] }
    if (result && typeof result === 'object' && 'json' in result) {
        return result.json as T
    }
    return result as T
}

/**
 * Get all connections for a user
 * @param userId - Optional user ID to filter connections
 */
export function useConnections(userId?: string) {
    return useQuery({
        queryKey: connectionKeys.list(userId),
        queryFn: async () => {
            const result = await api.connections.list(userId ? { userId } : undefined)
            const connections = extractData<Connection[]>(result)
            return { connections }
        },
        staleTime: 0, // Always refetch on mount
        refetchOnMount: 'always', // Always refetch when component mounts
    })
}

/**
 * Create a new connection
 * Also registers with the main server for AI features
 */
export function useCreateConnection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateConnectionInput) => {
            // First create connection in local database
            const result = await api.connections.create(input)
            const connection = extractData<Connection>(result)

            // Then register with main server for AI features (non-blocking)
            try {
                const mainServerUrl = MAIN_SERVER_ENDPOINT

                // Build connection string based on type
                const username = encodeURIComponent(input.username || '')
                const password = encodeURIComponent(input.password || '')
                const host = input.host || 'localhost'
                const port = input.port || 5432
                const database = input.database || ''

                let driver: string = input.type
                let connectionString = ''

                if (input.type === 'postgresql') {
                    driver = 'postgres'
                    connectionString = `postgresql+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
                } else if (input.type === 'mysql') {
                    connectionString = `mysql+asyncmy://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
                } else if (input.type === 'snowflake') {
                    // Snowflake uses account instead of host
                    const account = input.account || ''
                    connectionString = `snowflake://${username}:${password}@${account}${database ? '/' + database : ''}`
                } else {
                    connectionString = `${driver}://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
                }

                // Get auth token (using correct key for Firebase token)
                // authenticatedFetch handles token refresh automatically

                // Register with main server using authenticatedFetch
                // This automatically handles 401 with token refresh and retry
                const serverResponse = await authenticatedFetch(`${mainServerUrl}/llm-inference/create-connection`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        db_connection_string: connectionString,
                        driver: driver
                    })
                })

                if (serverResponse.ok) {
                    const serverResult = await serverResponse.json()
                    const externalConnId = serverResult.connection?.connection_id

                    if (externalConnId) {
                        // Update local connection with external ID
                        await api.connections.update({
                            id: connection.id,
                            externalConnectionId: externalConnId
                        })
                        connection.externalConnectionId = externalConnId
                        console.log('✅ Connection registered with server, external ID:', externalConnId)
                    }
                } else {
                    console.warn('⚠️ Failed to register connection with main server:', serverResponse.status)
                }
            } catch (serverError) {
                // Don't fail the whole operation if server registration fails
                console.warn('⚠️ Could not register connection with AI server:', serverError)
            }

            return connection
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.all })
            toast.success('Connection created successfully')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create connection')
        },
    })
}

/**
 * Update a connection
 */
export function useUpdateConnection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: { id: string } & Partial<CreateConnectionInput>) => {
            const result = await api.connections.update(input)
            return extractData<Connection>(result)
        },
        onSuccess: () => {
            // Invalidate all connection queries (including filtered by userId)
            queryClient.invalidateQueries({ queryKey: connectionKeys.all })
            toast.success('Connection updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update connection')
        },
    })
}

/**
 * Delete a connection
 */
export function useDeleteConnection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            await api.connections.remove({ id })
            return id
        },
        onSuccess: () => {
            // Invalidate all connection queries (including filtered by userId)
            queryClient.invalidateQueries({ queryKey: connectionKeys.all })
            toast.success('Connection deleted')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete connection')
        },
    })
}

/**
 * Test a connection
 */
export function useTestConnection() {
    return useMutation({
        mutationFn: async (input: { id?: string } & Partial<CreateConnectionInput>) => {
            const result = await api.connections.test(input)
            return extractData<{ success: boolean; message: string; latency: number }>(result)
        },
        onSuccess: (data) => {
            toast.success(`Connection successful (${data.latency}ms)`)
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Connection failed')
        },
    })
}
