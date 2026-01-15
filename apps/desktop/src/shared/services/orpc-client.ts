/**
 * oRPC Client Configuration
 * Type-safe client for API communication
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/orpc'

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth-token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

// Simple fetch-based client for now
// TODO: Once oRPC client types are fixed, switch back to createORPCClient
export const orpcClient = {
    chat: {
        createSession: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.createSession`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        getSession: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.getSession`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        listSessions: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.listSessions`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        sendMessage: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.sendMessage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        getMessages: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.getMessages`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        deleteSession: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.deleteSession`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
        updateSession: async (input: any) => {
            const res = await fetch(`${API_URL}/chat.updateSession`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(input)
            })
            return res.json()
        },
    }
}
