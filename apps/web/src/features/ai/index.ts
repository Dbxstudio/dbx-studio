/**
 * AI Feature - Module Exports
 */

// Components
export { AIChat } from './components/AIChat'
export { ChatMessage, ChatMessages } from './components/ChatMessage'
export { ChatInput, ProviderSelect, ChatSettings } from './components/ChatInput'
export { SessionList } from './components/SessionList'

// Pages
export { ChatPage } from './pages/ChatPage'

// Hooks
export {
    useCreateSession,
    useSession,
    useSessions,
    useSendMessage,
    useMessages,
    useDeleteSession,
    useUpdateSession,
} from './hooks/useChatQueries'

// Store
export { chatStore, chatActions } from './stores/chatStore'
export type { ChatState, ChatSettings as ChatStoreSettings } from './stores/chatStore'

// Types
export type { ChatMode, CreateSessionInput, SendMessageInput } from './hooks/useChatQueries'
