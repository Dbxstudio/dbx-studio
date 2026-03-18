import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, API_URL } from '../services/api'
import { toast } from 'sonner'
import { authenticatedFetch } from '../utils/authTokenManager'
import { MAIN_SERVER_ENDPOINT } from '../constants/serverConfig'
import { buildConnectionString } from '../utils/connectionString'

// Types
export interface Connection {
    id: string
    name: string
    type: 'postgresql' | 'mysql' | 'mssql' | 'clickhouse' | 'snowflake' | 'supabase' | 'redshift' | 'sqlite' | 'bigquery'
    userId?: string
    host?: string
    port?: number
    database?: string
    username?: string
    ssl?: boolean
    account?: string
    warehouse?: string
    role?: string
    projectId?: string
    keyFilename?: string
    dataset?: string
    connectionString?: string
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
    projectId?: string
    keyFilename?: string
    dataset?: string
    label?: string
    color?: string
    connectionString?: string
    showAllDatabases?: boolean
    requireServerRegistration?: boolean
    serverDriver?: 'mysql' | 'mariadb'
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

type ConnectionMutationInput = CreateConnectionInput

function getServerRegistrationConfig(input: ConnectionMutationInput) {
    const {
        showAllDatabases,
        requireServerRegistration,
        serverDriver,
        ...localInput
    } = input

    return {
        localInput,
        serverInput: {
            showAllDatabases,
            requireServerRegistration: requireServerRegistration ?? false,
            serverDriver,
        },
    }
}

async function extractErrorMessage(response: Response): Promise<string> {
    try {
        const text = await response.text()
        if (!text) {
            return `Request failed with status ${response.status}`
        }

        try {
            const parsed = JSON.parse(text)
            return parsed?.message || parsed?.error || text
        } catch {
            return text
        }
    } catch {
        return `Request failed with status ${response.status}`
    }
}

async function registerConnectionWithMainServer(
    input: Omit<CreateConnectionInput, 'showAllDatabases' | 'requireServerRegistration' | 'serverDriver'>,
    options: { showAllDatabases?: boolean; requireServerRegistration: boolean; serverDriver?: 'mysql' | 'mariadb' },
    connectionId: string,
) {
    const mainServerUrl = MAIN_SERVER_ENDPOINT
    const { connectionString, driver } = buildConnectionString(input)
    const serverDriver = options.serverDriver || driver

    try {
        const payload: Record<string, unknown> = {
            db_connection_string: connectionString,
            driver: serverDriver,
        }

        if (typeof options.showAllDatabases === 'boolean' && (serverDriver === 'mysql' || serverDriver === 'mariadb')) {
            payload.show_all_databases = options.showAllDatabases
        }

        const serverResponse = await authenticatedFetch(`${mainServerUrl}/llm-inference/create-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!serverResponse.ok) {
            throw new Error(await extractErrorMessage(serverResponse))
        }

        const serverResult = await serverResponse.json()
        const externalConnId = serverResult?.connection?.connection_id

        if (!externalConnId) {
            throw new Error('AI server did not return a connection ID')
        }

        await api.connections.update({
            id: connectionId,
            externalConnectionId: externalConnId,
        })

        return externalConnId as string
    } catch (serverError) {
        const msg = serverError instanceof Error ? serverError.message : 'Could not register connection with AI server'
        console.warn('⚠️ Could not register connection with AI server:', serverError)
        toast.warning(`Connection saved. AI features unavailable: ${msg}`)
        return undefined
    }
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
        mutationFn: async (input: ConnectionMutationInput) => {
            const { localInput, serverInput } = getServerRegistrationConfig(input)

            // First create connection in local database
            const result = await api.connections.create(localInput)
            const connection = extractData<Connection>(result)

            const externalConnId = await registerConnectionWithMainServer(localInput, serverInput, connection.id)

            if (externalConnId) {
                connection.externalConnectionId = externalConnId
                console.log('✅ Connection registered with server, external ID:', externalConnId)
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
            const { id, ...rest } = input
            const { localInput, serverInput } = getServerRegistrationConfig(rest as ConnectionMutationInput)
            const result = await api.connections.update({ id, ...localInput })
            const connection = extractData<Connection>(result)

            const type = localInput.type || connection.type
            const registrationInput = {
                name: localInput.name || connection.name,
                type,
                userId: localInput.userId || connection.userId,
                host: localInput.host ?? connection.host,
                port: localInput.port ?? connection.port,
                database: localInput.database ?? connection.database,
                username: localInput.username ?? connection.username,
                password: localInput.password,
                ssl: localInput.ssl ?? connection.ssl,
                account: localInput.account ?? connection.account,
                warehouse: localInput.warehouse ?? connection.warehouse,
                role: localInput.role ?? connection.role,
                projectId: localInput.projectId ?? connection.projectId,
                keyFilename: localInput.keyFilename ?? connection.keyFilename,
                dataset: localInput.dataset ?? connection.dataset,
                label: localInput.label ?? connection.label,
                color: localInput.color ?? connection.color,
                connectionString: localInput.connectionString ?? connection.connectionString,
            } satisfies Omit<CreateConnectionInput, 'showAllDatabases' | 'requireServerRegistration' | 'serverDriver'>

            const externalConnId = await registerConnectionWithMainServer(registrationInput, serverInput, id)

            if (externalConnId) {
                connection.externalConnectionId = externalConnId
            }

            return connection
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
            if (input.type === 'bigquery') {
                const token = localStorage.getItem('dbx_auth_token')
                const base = API_URL.replace(/\/$/, '')
                const candidateUrls = Array.from(
                    new Set([
                        '/api/v1/bigquery/test-connection',
                        `${base}/api/v1/bigquery/test-connection`,
                        `${base}/v1/bigquery/test-connection`,
                        'http://localhost:3002/api/v1/bigquery/test-connection',
                        'http://127.0.0.1:3002/api/v1/bigquery/test-connection',
                        ...(base.endsWith('/api') ? [`${base.replace(/\/api$/, '')}/api/v1/bigquery/test-connection`] : []),
                    ]),
                )

                let lastError = 'BigQuery connection failed'

                for (const url of candidateUrls) {
                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({
                                projectId: input.projectId,
                                keyFilename: input.keyFilename,
                                dataset: input.dataset || undefined,
                            }),
                        })

                        const data = await response.json().catch(() => ({}))

                        if (response.ok) {
                            return data as { success: boolean; message: string; latency: number }
                        }

                        lastError = data?.error || data?.message || `Request failed with status ${response.status}`

                        // Try the next candidate only for route mismatch.
                        if (response.status !== 404) {
                            throw new Error(lastError)
                        }
                    } catch (error) {
                        lastError = error instanceof Error ? error.message : 'Network error while testing BigQuery connection'
                        // Continue to next candidate URL when fetch throws.
                        continue
                    }
                }

                throw new Error(lastError)
            }

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
