/**
 * Chat Session List Component
 * Displays list of chat sessions with create/delete actions
 */

import React from 'react'
import { MessageSquare, Trash2, Plus } from 'lucide-react'

interface Session {
    id: string
    sessionName: string | null
    createdAt: Date
    lastActivity: Date
}

interface SessionListProps {
    sessions: Session[]
    activeSessionId?: string
    onSelectSession: (sessionId: string) => void
    onCreateSession: () => void
    onDeleteSession: (sessionId: string) => void
    isLoading?: boolean
}

export function SessionList({
    sessions,
    activeSessionId,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    isLoading = false,
}: SessionListProps) {
    return (
        <div className="session-list">
            <div className="session-list-header">
                <h2>Chat Sessions</h2>
                <button
                    onClick={onCreateSession}
                    className="create-session-button"
                    title="New chat session"
                    disabled={isLoading}
                >
                    <Plus size={18} />
                    New Chat
                </button>
            </div>

            <div className="sessions">
                {sessions.length === 0 ? (
                    <div className="empty-sessions">
                        <MessageSquare size={48} />
                        <p>No chat sessions yet</p>
                        <button onClick={onCreateSession} className="button-primary">
                            Create your first chat
                        </button>
                    </div>
                ) : (
                    sessions.map(session => (
                        <div
                            key={session.id}
                            className={`session-item ${activeSessionId === session.id ? 'active' : ''
                                }`}
                            onClick={() => onSelectSession(session.id)}
                        >
                            <div className="session-info">
                                <div className="session-name">
                                    {session.sessionName || 'Unnamed Session'}
                                </div>
                                <div className="session-time">
                                    {formatTime(session.lastActivity)}
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteSession(session.id)
                                }}
                                className="delete-button"
                                title="Delete session"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function formatTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
}
