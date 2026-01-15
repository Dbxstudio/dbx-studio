import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

// Types
export interface SchemaInfo {
    name: string
    tables: { name: string; columns: { name: string; type: string }[] }[]
}

// Query Keys
export const schemaKeys = {
    all: ['schemas'] as const,
    connection: (connectionId: string) => [...schemaKeys.all, connectionId] as const,
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
 * Get all schemas for a connection
 */
export function useSchemas(connectionId: string | undefined) {
    return useQuery({
        queryKey: schemaKeys.connection(connectionId || ''),
        queryFn: async () => {
            if (!connectionId) return []
            const result = await api.tables.schemas({ connectionId })
            return extractData<SchemaInfo[]>(result)
        },
        enabled: !!connectionId,
    })
}
