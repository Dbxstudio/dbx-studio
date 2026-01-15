/**
 * AI Chat Message Component
 * Renders user and assistant messages with SQL blocks, code highlighting, and actions
 */

import React from 'react'
import { Copy, Check, Play } from 'lucide-react'
import { useState } from 'react'

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
    sql?: string
    thinking?: string
    timestamp: string
}

interface ChatMessageProps {
    message: Message
    onExecuteSQL?: (sql: string) => void
}

export function ChatMessage({ message, onExecuteSQL }: ChatMessageProps) {
    const [copiedSql, setCopiedSql] = useState(false)
    const [copiedContent, setCopiedContent] = useState(false)

    const handleCopySQL = async () => {
        if (message.sql) {
            await navigator.clipboard.writeText(message.sql)
            setCopiedSql(true)
            setTimeout(() => setCopiedSql(false), 2000)
        }
    }

    const handleCopyContent = async () => {
        await navigator.clipboard.writeText(message.content)
        setCopiedContent(true)
        setTimeout(() => setCopiedContent(false), 2000)
    }

    return (
        <div className={`chat-message ${message.role}`}>
            <div className="message-header">
                <div className="message-role">
                    {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
                </div>
                <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                </div>
            </div>

            {/* Thinking Process (if available) */}
            {message.thinking && (
                <div className="message-thinking">
                    <details>
                        <summary>💭 Thinking process</summary>
                        <div className="thinking-content">
                            {message.thinking}
                        </div>
                    </details>
                </div>
            )}

            {/* Message Content */}
            <div className="message-content">
                <div className="prose dark:prose-invert max-w-none">
                    {message.content}
                </div>
                <button
                    onClick={handleCopyContent}
                    className="copy-button"
                    title="Copy message"
                >
                    {copiedContent ? <Check size={16} /> : <Copy size={16} />}
                </button>
            </div>

            {/* SQL Code Block */}
            {message.sql && (
                <div className="sql-block">
                    <div className="sql-header">
                        <span className="sql-label">📊 SQL Query</span>
                        <div className="sql-actions">
                            <button
                                onClick={handleCopySQL}
                                className="action-button"
                                title="Copy SQL"
                            >
                                {copiedSql ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                            {onExecuteSQL && (
                                <button
                                    onClick={() => onExecuteSQL(message.sql!)}
                                    className="action-button execute"
                                    title="Execute query"
                                >
                                    <Play size={16} />
                                    Execute
                                </button>
                            )}
                        </div>
                    </div>
                    <pre className="sql-code">
                        <code className="language-sql">{message.sql}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}

/**
 * Chat Messages List Component
 */
interface ChatMessagesProps {
    messages: Message[]
    onExecuteSQL?: (sql: string) => void
    isLoading?: boolean
}

export function ChatMessages({ messages, onExecuteSQL, isLoading }: ChatMessagesProps) {
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    return (
        <div className="chat-messages">
            {messages.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>Start a conversation</h3>
                    <p>Ask me anything about your database</p>
                </div>
            ) : (
                messages.map((message, index) => (
                    <ChatMessage
                        key={index}
                        message={message}
                        onExecuteSQL={onExecuteSQL}
                    />
                ))
            )}

            {isLoading && (
                <div className="chat-message assistant loading">
                    <div className="message-header">
                        <div className="message-role">🤖 Assistant</div>
                    </div>
                    <div className="message-content">
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    )
}
