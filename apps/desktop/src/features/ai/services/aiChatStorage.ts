/**
 * AI Chat Storage Service
 * Handles persistence of chat messages and sessions in localStorage
 */

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    sql?: string
    timestamp: Date
    isError?: boolean
}

interface ChatSession {
    sessionId: string
    messages: Message[]
    createdAt: Date
    updatedAt: Date
    connectionId?: string
    schema?: string
}

const STORAGE_KEY_PREFIX = 'ai_chat_'
const CURRENT_SESSION_KEY = 'ai_chat_current_session'
const SESSIONS_LIST_KEY = 'ai_chat_sessions'

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Save messages to a session
 */
export function saveSession(
    sessionId: string,
    messages: Message[],
    connectionId?: string,
    schema?: string
): void {
    try {
        const session: ChatSession = {
            sessionId,
            messages: messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
            })),
            createdAt: new Date(),
            updatedAt: new Date(),
            connectionId,
            schema
        }

        localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(session))

        // Update sessions list
        const sessionsList = getSessionsList()
        if (!sessionsList.includes(sessionId)) {
            sessionsList.push(sessionId)
            localStorage.setItem(SESSIONS_LIST_KEY, JSON.stringify(sessionsList))
        }
    } catch (error) {
        console.error('Failed to save chat session:', error)
    }
}

/**
 * Load a session by ID
 */
export function loadSession(sessionId: string): ChatSession | null {
    try {
        const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`)
        if (!data) return null

        const session = JSON.parse(data) as ChatSession

        // Convert timestamp strings back to Date objects
        session.messages = session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
        }))
        session.createdAt = new Date(session.createdAt)
        session.updatedAt = new Date(session.updatedAt)

        return session
    } catch (error) {
        console.error('Failed to load chat session:', error)
        return null
    }
}

/**
 * Get list of all session IDs
 */
export function getSessionsList(): string[] {
    try {
        const data = localStorage.getItem(SESSIONS_LIST_KEY)
        return data ? JSON.parse(data) : []
    } catch (error) {
        console.error('Failed to load sessions list:', error)
        return []
    }
}

/**
 * Get all sessions with metadata
 */
export function getAllSessions(): ChatSession[] {
    const sessionIds = getSessionsList()
    const sessions: ChatSession[] = []

    for (const sessionId of sessionIds) {
        const session = loadSession(sessionId)
        if (session) {
            sessions.push(session)
        }
    }

    // Sort by most recent first
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
    try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`)

        // Update sessions list
        const sessionsList = getSessionsList()
        const updatedList = sessionsList.filter(id => id !== sessionId)
        localStorage.setItem(SESSIONS_LIST_KEY, JSON.stringify(updatedList))
    } catch (error) {
        console.error('Failed to delete chat session:', error)
    }
}

/**
 * Clear all sessions
 */
export function clearAllSessions(): void {
    try {
        const sessionIds = getSessionsList()
        for (const sessionId of sessionIds) {
            localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`)
        }
        localStorage.removeItem(SESSIONS_LIST_KEY)
        localStorage.removeItem(CURRENT_SESSION_KEY)
    } catch (error) {
        console.error('Failed to clear all sessions:', error)
    }
}

/**
 * Get or create current session
 */
export function getCurrentSessionId(): string {
    try {
        const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY)
        if (currentSessionId) {
            return currentSessionId
        }

        // Create new session
        const newSessionId = generateSessionId()
        localStorage.setItem(CURRENT_SESSION_KEY, newSessionId)
        return newSessionId
    } catch (error) {
        console.error('Failed to get current session:', error)
        return generateSessionId()
    }
}

/**
 * Set current session
 */
export function setCurrentSessionId(sessionId: string): void {
    try {
        localStorage.setItem(CURRENT_SESSION_KEY, sessionId)
    } catch (error) {
        console.error('Failed to set current session:', error)
    }
}

/**
 * Create a new session
 */
export function createNewSession(): string {
    const sessionId = generateSessionId()
    setCurrentSessionId(sessionId)
    return sessionId
}

/**
 * Auto-save messages to current session
 */
export function autoSaveMessages(
    messages: Message[],
    connectionId?: string,
    schema?: string
): void {
    const sessionId = getCurrentSessionId()
    saveSession(sessionId, messages, connectionId, schema)
}
