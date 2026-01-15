/**
 * AI Chat Store - TanStack Store
 * Phase 8: Frontend State Management
 */

import { Store } from '@tanstack/react-store'

export interface ChatSettings {
    provider: string
    model: string
    useMemory: boolean
    useThinking: boolean
    temperature: number
}

export interface ChatState {
    activeSessionId: string | null
    activeConnectionId: string | null
    settings: ChatSettings
}

// Default settings
const defaultSettings: ChatSettings = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    useMemory: true,
    useThinking: false,
    temperature: 0.7,
}

// Load settings from localStorage
function loadSettings(): ChatSettings {
    try {
        const saved = localStorage.getItem('chat-settings')
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings
    } catch {
        return defaultSettings
    }
}

// Initial state
const initialState: ChatState = {
    activeSessionId: localStorage.getItem('active-session-id'),
    activeConnectionId: localStorage.getItem('active-connection-id'),
    settings: loadSettings(),
}

// Create store
export const chatStore = new Store<ChatState>(initialState)

// Actions
export const chatActions = {
    setActiveSession(sessionId: string | null) {
        chatStore.setState(state => ({
            ...state,
            activeSessionId: sessionId,
        }))
        if (sessionId) {
            localStorage.setItem('active-session-id', sessionId)
        } else {
            localStorage.removeItem('active-session-id')
        }
    },

    setActiveConnection(connectionId: string | null) {
        chatStore.setState(state => ({
            ...state,
            activeConnectionId: connectionId,
        }))
        if (connectionId) {
            localStorage.setItem('active-connection-id', connectionId)
        } else {
            localStorage.removeItem('active-connection-id')
        }
    },

    updateSettings(settings: Partial<ChatSettings>) {
        chatStore.setState(state => {
            const newSettings = { ...state.settings, ...settings }
            localStorage.setItem('chat-settings', JSON.stringify(newSettings))
            return {
                ...state,
                settings: newSettings,
            }
        })
    },

    setProvider(provider: string) {
        this.updateSettings({ provider })
    },

    setModel(model: string) {
        this.updateSettings({ model })
    },

    toggleMemory() {
        const current = chatStore.state.settings.useMemory
        this.updateSettings({ useMemory: !current })
    },

    toggleThinking() {
        const current = chatStore.state.settings.useThinking
        this.updateSettings({ useThinking: !current })
    },
}
