/**
 * AI Chat Input Component
 * Message input with send button, keyboard shortcuts, and provider selection
 */

import React, { useState, useRef, useEffect } from 'react'
import { Clock3, Send, Settings2, Loader2 } from 'lucide-react'
import { useRecentQueries } from '../hooks/useRecentQueries'

interface ChatInputProps {
    onSendMessage: (message: string) => void
    isLoading?: boolean
    placeholder?: string
    disabled?: boolean
}

export function ChatInput({
    onSendMessage,
    isLoading = false,
    placeholder = 'Ask a question about your database...',
    disabled = false
}: ChatInputProps) {
    const [message, setMessage] = useState('')
    const [isRecentOpen, setIsRecentOpen] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const { recentQueries, addRecentQuery } = useRecentQueries()

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [message])

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsRecentOpen(false)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
        }
    }, [])

    const handleSend = () => {
        if (message.trim() && !isLoading && !disabled) {
            const nextMessage = message.trim()

            addRecentQuery(nextMessage)
            onSendMessage(nextMessage)
            setMessage('')
            setIsRecentOpen(false)
        }
    }

    const handleRecentSelect = (query: string) => {
        setMessage(query)
        setIsRecentOpen(false)
        requestAnimationFrame(() => textareaRef.current?.focus())
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div ref={containerRef} className="chat-input-container">
            <button
                type="button"
                className="recent-queries-toggle"
                onClick={() => setIsRecentOpen((current) => !current)}
                disabled={disabled}
                title="Recent queries"
            >
                <Clock3 size={18} />
            </button>
            <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onFocus={() => {
                    if (recentQueries.length > 0) {
                        setIsRecentOpen(true)
                    }
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading || disabled}
                className="chat-input"
                rows={1}
            />
            {isRecentOpen && recentQueries.length > 0 && (
                <div className="recent-queries-dropdown">
                    <div className="recent-queries-title">Recent Queries</div>
                    {recentQueries.map((query) => (
                        <button
                            key={query}
                            type="button"
                            className="recent-query-item"
                            onClick={() => handleRecentSelect(query)}
                        >
                            {query}
                        </button>
                    ))}
                </div>
            )}
            <button
                onClick={handleSend}
                disabled={!message.trim() || isLoading || disabled}
                className="send-button"
                title="Send message (Enter)"
            >
                {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : (
                    <Send size={20} />
                )}
            </button>
        </div>
    )
}

/**
 * Provider Selection Component
 */
interface ProviderSelectProps {
    provider: string
    onProviderChange: (provider: string) => void
    model?: string
    onModelChange?: (model: string) => void
}

export function ProviderSelect({
    provider,
    onProviderChange,
    model,
    onModelChange
}: ProviderSelectProps) {
    const providers = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
        { id: 'claude', name: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] },
        { id: 'bedrock', name: 'AWS Bedrock', models: ['us.anthropic.claude-3-5-sonnet-20241022-v1:0', 'us.anthropic.claude-3-5-haiku-20241022-v1:0'] },
    ]

    const currentProvider = providers.find(p => p.id === provider)

    return (
        <div className="provider-select">
            <div className="select-group">
                <label>Provider</label>
                <select
                    value={provider}
                    onChange={(e) => onProviderChange(e.target.value)}
                    className="select"
                >
                    {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {onModelChange && currentProvider && (
                <div className="select-group">
                    <label>Model</label>
                    <select
                        value={model}
                        onChange={(e) => onModelChange(e.target.value)}
                        className="select"
                    >
                        {currentProvider.models.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

/**
 * Chat Settings Panel
 */
interface ChatSettingsProps {
    useMemory: boolean
    onUseMemoryChange: (enabled: boolean) => void
    useThinking: boolean
    onUseThinkingChange: (enabled: boolean) => void
}

export function ChatSettings({
    useMemory,
    onUseMemoryChange,
    useThinking,
    onUseThinkingChange,
}: ChatSettingsProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="chat-settings">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="settings-toggle"
                title="Chat settings"
            >
                <Settings2 size={20} />
            </button>

            {isOpen && (
                <div className="settings-panel">
                    <h3>Chat Settings</h3>

                    <label className="setting-item">
                        <input
                            type="checkbox"
                            checked={useMemory}
                            onChange={(e) => onUseMemoryChange(e.target.checked)}
                        />
                        <div>
                            <span>Use Memory</span>
                            <small>Include conversation history for context</small>
                        </div>
                    </label>

                    <label className="setting-item">
                        <input
                            type="checkbox"
                            checked={useThinking}
                            onChange={(e) => onUseThinkingChange(e.target.checked)}
                        />
                        <div>
                            <span>Think Mode</span>
                            <small>Show AI's reasoning process</small>
                        </div>
                    </label>
                </div>
            )}
        </div>
    )
}
