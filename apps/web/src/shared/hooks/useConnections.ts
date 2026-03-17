import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toast } from 'sonner'
import { authenticatedFetch } from '../utils/authTokenManager'
import { MAIN_SERVER_ENDPOINT } from '../constants/serverConfig'

// Types
export interface Connection {
    id: string
    name: string
    type: 'postgresql' | 'mysql' | 'mssql' | 'clickhouse' | 'snowflake' | 'supabase' | 'redshift' | 'sqlite'
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

function buildConnectionString(input: Omit<CreateConnectionInput, 'showAllDatabases' | 'requireServerRegistration' | 'serverDriver'>) {
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
        const account = input.account || ''
        connectionString = `snowflake://${username}:${password}@${account}${database ? '/' + database : ''}`
    } else if (input.type === 'supabase') {
        driver = 'postgres'
        if (input.connectionString) {
            connectionString = input.connectionString
        } else {
            connectionString = `postgresql+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
        }
    } else if (input.type === 'redshift') {
        driver = 'redshift'
        connectionString = `redshift+asyncpg://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    } else if (input.type === 'sqlite') {
        driver = 'sqlite'
        connectionString = `sqlite+aiosqlite:///${database}`
    } else {
        connectionString = `${driver}://${username}:${password}@${host}:${port}${database ? '/' + database : ''}`
    }

    return {
        connectionString,
        driver,
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
