import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

// API base URL
// In production (Vercel), use the same domain. In development, use localhost
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3002')

// Create the oRPC link with correct path format
const link = new RPCLink({
    url: `${API_URL}/api/rpc`,
    headers: () => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }

        // Add auth token if available
        const token = localStorage.getItem('dbx_auth_token')
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        return headers
    },
})

// Create the oRPC client
// The client will automatically call the correct endpoints like:
// - connections.list -> POST /api/rpc/connections/list
// - connections.create -> POST /api/rpc/connections/create
export const api = createORPCClient<{
    connections: {
        list: (input?: { userId?: string }) => Promise<any[]>
        create: (input: any) => Promise<any>
        update: (input: any) => Promise<any>
        remove: (input: { id: string }) => Promise<any>
        test: (input: any) => Promise<any>
    }
    tables: {
        list: (input: { connectionId: string; schema?: string }) => Promise<any[]>
        columns: (input: { connectionId: string; tableName: string; schema?: string }) => Promise<any[]>
        data: (input: any) => Promise<any>
        count: (input: { connectionId: string; tableName: string; schema?: string }) => Promise<{ count: number }>
        insertRow: (input: any) => Promise<any>
        updateRow: (input: any) => Promise<any>
        deleteRow: (input: any) => Promise<any>
        schemas: (input: { connectionId: string }) => Promise<any[]>
    }
    queries: {
        execute: (input: any) => Promise<any>
        list: (input?: any) => Promise<any[]>
        toggleFavorite: (input: { id: string }) => Promise<any>
        remove: (input: { id: string }) => Promise<any>
    }
    ai: {
        getCredentials: () => Promise<any>
        setCredentials: (input: {
            selectedProvider?: string
            selectedModel?: string
            selectedModelId?: number
            AWS_ACCESS_KEY_ID?: string
            AWS_SECRET_ACCESS_KEY?: string
            AWS_REGION?: string
            ANTHROPIC_API_KEY?: string
            OPENAI_API_KEY?: string
        }) => Promise<any>
        clearCredentials: () => Promise<any>
        query: (input: {
            query: string
            message?: string
            prompt?: string
            provider?: string
            model?: string
            model_id?: number
            service_id?: number
            connection_id?: string
            external_connection_id?: string
            schema?: string
            tables?: string[]
            database_name?: string
            AWS_ACCESS_KEY_ID?: string
            AWS_SECRET_ACCESS_KEY?: string
            AWS_REGION?: string
            ANTHROPIC_API_KEY?: string
            OPENAI_API_KEY?: string
        }) => Promise<any>
    }
}>(link)

// Export base URL for other uses
export { API_URL }
