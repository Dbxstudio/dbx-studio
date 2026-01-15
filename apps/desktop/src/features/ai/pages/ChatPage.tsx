/**
 * AI Chat Page - Full Screen Chat Route
 * Phase 9: Complete chat interface
 */

import React, { useState, useEffect } from 'react'
import { useStore } from '@tanstack/react-store'
import { toast } from 'sonner'
import {
    useCreateSession,
    useSessions,
    useMessages,
    useSendMessage,
    useDeleteSession,
} from '../hooks/useChatQueries'
import { chatStore, chatActions } from '../stores/chatStore'
import { SessionList } from '../components/SessionList'
import { ChatMessages } from '../components/ChatMessage'
import { ChatInput, ProviderSelect, ChatSettings } from '../components/ChatInput'
import '../components/chat.css'

export function ChatPage() {
    const { activeSessionId, activeConnectionId, settings } = useStore(chatStore)
    const [isCreatingSession, setIsCreatingSession] = useState(false)

    // Queries
    const { data: sessionsData } = useSessions(activeConnectionId || undefined)
    const { data: messagesData, isLoading: loadingMessages } = useMessages(activeSessionId || undefined)

    // Mutations
    const createSession = useCreateSession()
    const sendMessage = useSendMessage()
    const deleteSession = useDeleteSession()

    // Format messages for display
    const messages = messagesData?.messages?.flatMap((conv: any) =>
        (conv.messages as any[]).map(msg => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString(),
        }))
    ) || []

    // Handler: Create new session
    const handleCreateSession = async () => {
        if (!activeConnectionId) {
            toast.error('Please select a connection first')
            return
        }

        setIsCreatingSession(true)
        try {
            const result = await createSession.mutateAsync({
                connectionId: activeConnectionId,
                mode: 'collection',
                sessionName: `Chat ${new Date().toLocaleDateString()}`,
            })

            if (result.success) {
                chatActions.setActiveSession(result.session.id)
                toast.success('New chat session created')
            }
        } catch (error) {
            toast.error('Failed to create session')
            console.error(error)
        } finally {
            setIsCreatingSession(false)
        }
    }

    // Handler: Select session
    const handleSelectSession = (sessionId: string) => {
        chatActions.setActiveSession(sessionId)
    }

    // Handler: Delete session
    const handleDeleteSession = async (sessionId: string) => {
        try {
            await deleteSession.mutateAsync(sessionId)
            if (activeSessionId === sessionId) {
                chatActions.setActiveSession(null)
            }
            toast.success('Session deleted')
        } catch (error) {
            toast.error('Failed to delete session')
            console.error(error)
        }
    }

    // Handler: Send message
    const handleSendMessage = async (message: string) => {
        if (!activeSessionId) {
            toast.error('Please select or create a session first')
            return
        }

        try {
            const result = await sendMessage.mutateAsync({
                sessionId: activeSessionId,
                message,
                provider: settings.provider,
                model: settings.model,
                useMemory: settings.useMemory,
                useThinking: settings.useThinking,
            })

            if (!result.success) {
                toast.error(result.error || 'Failed to send message')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to send message')
        }
    }

    // Handler: Execute SQL
    const handleExecuteSQL = (_sql: string) => {
        toast.info('SQL execution not yet implemented')
    }

    // Auto-create session if none exists
    useEffect(() => {
        if (!activeSessionId && sessionsData?.sessions?.length === 0 && activeConnectionId) {
            handleCreateSession()
        }
    }, [sessionsData, activeSessionId, activeConnectionId])

    return (
        <div className="chat-container">
            {/* Session List Sidebar */}
            <SessionList
                sessions={sessionsData?.sessions || []}
                activeSessionId={activeSessionId || undefined}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                isLoading={isCreatingSession}
            />

            {/* Main Chat Area */}
            <div className="chat-main">
                {/* Header */}
                <div className="chat-header">
                    <h1>AI Chat</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <ChatSettings
                            useMemory={settings.useMemory}
                            onUseMemoryChange={() => chatActions.toggleMemory()}
                            useThinking={settings.useThinking}
                            onUseThinkingChange={() => chatActions.toggleThinking()}
                        />
                    </div>
                </div>

                {/* Messages */}
                <ChatMessages
                    messages={messages}
                    onExecuteSQL={handleExecuteSQL}
                    isLoading={sendMessage.isPending || loadingMessages}
                />

                {/* Input Area */}
                <div>
                    <ProviderSelect
                        provider={settings.provider}
                        onProviderChange={(p) => chatActions.setProvider(p)}
                        model={settings.model}
                        onModelChange={(m) => chatActions.setModel(m)}
                    />
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        isLoading={sendMessage.isPending}
                        disabled={!activeSessionId}
                        placeholder={
                            activeSessionId
                                ? 'Ask a question about your database...'
                                : 'Create or select a session to start chatting'
                        }
                    />
                </div>
            </div>
        </div>
    )
}
