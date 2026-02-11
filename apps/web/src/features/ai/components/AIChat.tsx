import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, X, Sparkles, Settings, RefreshCw, AlertCircle, Play, Copy, Check } from 'lucide-react'
import {
    PROVIDERS,
    MODELS,
    getModelsByProvider,
    getProviderById,
    providerRequiresCredentials,
} from '../services/aiConfig'
import aiService from '../services/aiService'
import './ai-chat.css'

interface AIChatProps {
    isOpen: boolean
    onClose: () => void
    onRunQuery?: (sql: string) => void
    connectionId?: string
    externalConnectionId?: string
    schema?: string
    tables?: string[]
    tableDetails?: any
    isDarkTheme?: boolean
    worksheets?: { id: string; title: string }[]
    activeWorksheetId?: string
    onSelectWorksheet?: (id: string) => void
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    sql?: string
    timestamp: Date
}

export function AIChat({
    isOpen,
    onClose,
    connectionId,
    externalConnectionId,
    schema,
    tables,
    tableDetails,
    onRunQuery,
    isDarkTheme = true
}: AIChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const inputRef = useRef<HTMLTextAreaElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    // AI Settings
    const [selectedProvider, setSelectedProvider] = useState(
        localStorage.getItem('ai_selected_provider') || 'dbx-agent'
    )
    const [selectedModelId, setSelectedModelId] = useState(
        parseInt(localStorage.getItem('ai_selected_model_id') || '801', 10)
    )

    // Credentials state
    const [credentials, setCredentials] = useState({
        AWS_ACCESS_KEY_ID: localStorage.getItem('ai_aws_access_key_id') || '',
        AWS_SECRET_ACCESS_KEY: localStorage.getItem('ai_aws_secret_access_key') || '',
        AWS_REGION: localStorage.getItem('ai_aws_region') || 'us-east-1',
        OPENAI_API_KEY: localStorage.getItem('ai_openai_api_key') || '',
        ANTHROPIC_API_KEY: localStorage.getItem('ai_anthropic_api_key') || '',
    })



    // Get provider models and info
    const providerModels = getModelsByProvider(selectedProvider)
    const currentProvider = getProviderById(selectedProvider)
    const currentModel = MODELS.find(m => m.modelId === selectedModelId)
    const requiresCredentials = providerRequiresCredentials(selectedProvider)

    // Check if credentials are configured
    const hasCredentials = useCallback(() => {
        if (!requiresCredentials) return true

        switch (selectedProvider) {
            case 'bedrock':
                return !!(credentials.AWS_ACCESS_KEY_ID && credentials.AWS_SECRET_ACCESS_KEY)
            case 'openai':
                return !!credentials.OPENAI_API_KEY
            case 'claude':
                return !!credentials.ANTHROPIC_API_KEY
            default:
                return true
        }
    }, [selectedProvider, credentials, requiresCredentials])

    const handleSaveSettings = async () => {
        // Save to aiService (which also saves to localStorage)
        const currentModel = MODELS.find(m => m.modelId === selectedModelId)

        await aiService.setCredentials({
            selectedProvider,
            selectedModel: currentModel?.modelName,
            selectedModelId,
            AWS_ACCESS_KEY_ID: credentials.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: credentials.AWS_SECRET_ACCESS_KEY,
            AWS_REGION: credentials.AWS_REGION,
            OPENAI_API_KEY: credentials.OPENAI_API_KEY,
            ANTHROPIC_API_KEY: credentials.ANTHROPIC_API_KEY,
        })

        setShowSettings(false)
    }

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date(),
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        try {
            const response = await aiService.sendMessage(userMsg.content, {
                connectionId,
                externalConnectionId,
                schema,
                tables,
                tableDetails,
            })

            if (response.success) {
                const assistantMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response.message || 'No response content',
                    sql: response.sql,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, assistantMsg])
            } else {
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Error: ' + (response.error || 'Unknown error'),
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, errorMsg])
            }
        } catch (err: any) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Error: ' + (err.message || 'Failed to send message'),
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e as any)
        }
    }

    const themeClass = isDarkTheme ? 'dark-theme' : 'light-theme'

    // Helper to render message content with SQL Extraction
    const renderMessageContent = (msg: Message) => {
        if (msg.role === 'user') {
            return <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        }

        // If specific SQL field exists, use it
        if (msg.sql) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Explanation text hidden as per user request */}
                    <div style={{
                        marginTop: '8px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid #3a3a3a',
                        background: '#1a1a1a'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: '#252525',
                            borderBottom: '1px solid #3a3a3a'
                        }}>
                            <span style={{ fontSize: '11px', color: '#9fb0c8', fontWeight: 600 }}>SQL Query</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    onClick={() => handleCopy(msg.sql!, msg.id)}
                                    title="Copy SQL"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: copiedId === msg.id ? '#4ade80' : '#9fb0c8',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        fontSize: '11px'
                                    }}
                                >
                                    {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedId === msg.id ? 'Copied' : 'Copy'}
                                </button>
                                {onRunQuery && (
                                    <button
                                        onClick={() => onRunQuery(msg.sql!)}
                                        title="Run Query"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            background: '#4a9eff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            fontWeight: 500
                                        }}
                                    >
                                        <Play size={12} fill="currentColor" />
                                        Run
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{
                            padding: '10px',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            color: '#d4d4d4',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.sql}
                        </div>
                    </div>
                </div>
            )
        }

        // Parse markdown code blocks if no explicit SQL field
        const parts = msg.content.split(/(```sql[\s\S]*?```)/g)
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parts.map((part, index) => {
                    if (part.startsWith('```sql')) {
                        const code = part.replace(/```sql\n?/, '').replace(/```$/, '').trim()
                        return (
                            <div key={index} style={{
                                marginTop: '4px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: '1px solid #3a3a3a',
                                background: '#1a1a1a'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 10px',
                                    background: '#252525',
                                    borderBottom: '1px solid #3a3a3a'
                                }}>
                                    <span style={{ fontSize: '11px', color: '#9fb0c8', fontWeight: 600 }}>SQL Query</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => handleCopy(code, `${msg.id}-${index}`)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: copiedId === `${msg.id}-${index}` ? '#4ade80' : '#9fb0c8',
                                                cursor: 'pointer',
                                                padding: '2px 4px',
                                                fontSize: '11px'
                                            }}
                                        >
                                            {copiedId === `${msg.id}-${index}` ? <Check size={12} /> : <Copy size={12} />}
                                            {copiedId === `${msg.id}-${index}` ? 'Copied' : 'Copy'}
                                        </button>
                                        {onRunQuery && (
                                            <button
                                                onClick={() => onRunQuery(code)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '4px',
                                                    background: '#4a9eff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    padding: '2px 8px',
                                                    fontSize: '11px',
                                                    fontWeight: 500
                                                }}
                                            >
                                                <Play size={12} fill="currentColor" />
                                                Run
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{
                                    padding: '10px',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    color: '#d4d4d4',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {code}
                                </div>
                            </div>
                        )
                    }
                    return <div key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</div>
                })}
            </div>
        )
    }

    return (
        <div className={`workspace-ai-chat ${themeClass}`} style={{
            backgroundColor: '#1a1a1a',
            color: '#e6eef8',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: '#1f1f1f',
                borderBottom: '1px solid #333',
                flexShrink: 0,
                gap: '12px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#4a9eff" />
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Copilot</h3>
                    <span style={{ fontSize: '11px', color: '#9fb0c8', background: '#2a2a2a', border: '1px solid #3a3a3a', padding: '3px 8px', borderRadius: '4px', fontWeight: 500 }}>
                        DBX Agent
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {messages.length > 0 && (
                        <button
                            onClick={() => setMessages([])}
                            style={{
                                background: 'transparent',
                                border: '1px solid #3a3a3a',
                                color: '#9fb0c8',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            title="Clear Chat"
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={{
                            background: 'transparent',
                            border: '1px solid #3a3a3a',
                            color: '#9fb0c8',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        title="Settings"
                    >
                        <Settings size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: '1px solid #3a3a3a',
                            color: '#9fb0c8',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div style={{
                    padding: '12px',
                    background: '#2a2a2a',
                    borderBottom: '1px solid #3a3a3a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>Provider</label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            style={{
                                padding: '8px 10px',
                                fontSize: '13px',
                                background: '#1a1a1a',
                                color: '#d4d4d4',
                                border: '1px solid #3a3a3a',
                                borderRadius: '6px',
                            }}
                        >
                            {PROVIDERS.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {!p.requiresCredentials ? '(No API Key)' : ''}
                                </option>
                            ))}
                        </select>
                        <span style={{ fontSize: '11px', color: '#9fb0c8' }}>{currentProvider?.description}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>Model</label>
                        <select
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(parseInt(e.target.value, 10))}
                            style={{
                                padding: '8px 10px',
                                fontSize: '13px',
                                background: '#1a1a1a',
                                color: '#d4d4d4',
                                border: '1px solid #3a3a3a',
                                borderRadius: '6px',
                            }}
                        >
                            {providerModels.map(m => (
                                <option key={m.modelId} value={m.modelId}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* OpenAI Credentials */}
                    {selectedProvider === 'openai' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>OpenAI API Key</label>
                            <input
                                type="password"
                                value={credentials.OPENAI_API_KEY}
                                onChange={(e) => setCredentials(prev => ({ ...prev, OPENAI_API_KEY: e.target.value }))}
                                placeholder="sk-..."
                                style={{
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    background: '#1a1a1a',
                                    color: '#d4d4d4',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '6px',
                                }}
                            />
                        </div>
                    )}

                    {/* Anthropic Credentials */}
                    {selectedProvider === 'claude' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>Anthropic API Key</label>
                            <input
                                type="password"
                                value={credentials.ANTHROPIC_API_KEY}
                                onChange={(e) => setCredentials(prev => ({ ...prev, ANTHROPIC_API_KEY: e.target.value }))}
                                placeholder="sk-ant-..."
                                style={{
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    background: '#1a1a1a',
                                    color: '#d4d4d4',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '6px',
                                }}
                            />
                        </div>
                    )}

                    {/* AWS Bedrock Credentials */}
                    {selectedProvider === 'bedrock' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>AWS Access Key ID</label>
                                <input
                                    type="text"
                                    value={credentials.AWS_ACCESS_KEY_ID}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_ACCESS_KEY_ID: e.target.value }))}
                                    placeholder="AKIA..."
                                    style={{
                                        padding: '8px 10px',
                                        fontSize: '13px',
                                        background: '#1a1a1a',
                                        color: '#d4d4d4',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '6px',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>AWS Secret Access Key</label>
                                <input
                                    type="password"
                                    value={credentials.AWS_SECRET_ACCESS_KEY}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_SECRET_ACCESS_KEY: e.target.value }))}
                                    placeholder="••••••••"
                                    style={{
                                        padding: '8px 10px',
                                        fontSize: '13px',
                                        background: '#1a1a1a',
                                        color: '#d4d4d4',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '6px',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8' }}>AWS Region</label>
                                <input
                                    type="text"
                                    value={credentials.AWS_REGION}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_REGION: e.target.value }))}
                                    placeholder="us-east-1"
                                    style={{
                                        padding: '8px 10px',
                                        fontSize: '13px',
                                        background: '#1a1a1a',
                                        color: '#d4d4d4',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '6px',
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* DBX Agent Info */}
                    {selectedProvider === 'dbx-agent' && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 12px',
                            background: '#1a1a1a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#9fb0c8',
                        }}>
                            <AlertCircle size={14} />
                            <span>DBX Agent uses server-side processing. No API keys required!</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                            onClick={handleSaveSettings}
                            style={{
                                padding: '8px 16px',
                                fontSize: '13px',
                                background: '#4a9eff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Save Settings
                        </button>
                        <button
                            onClick={() => setShowSettings(false)}
                            style={{
                                padding: '8px 16px',
                                fontSize: '13px',
                                background: 'transparent',
                                color: '#9fb0c8',
                                border: '1px solid #3a3a3a',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '16px',
                gap: '12px',
                overflowY: 'auto',
                backgroundColor: '#1a1a1a',
                color: '#e6eef8',
            }}>
                {messages.length === 0 ? (
                    <div style={{
                        margin: '0 auto',
                        padding: '24px 16px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        color: '#e6eef8',
                        background: '#1a1a1a',
                        borderRadius: '8px',
                    }}>
                        <span style={{ fontSize: '48px', opacity: 1, marginBottom: '12px' }}>✨</span>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                            AI SQL Assistant
                        </div>
                        <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#d4d4d4', opacity: 1, margin: 0 }}>
                            Describe what data you need and I'll generate SQL queries for you.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', maxWidth: '90%', marginLeft: 'auto', marginRight: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', fontSize: '13px', color: '#d4d4d4' }}>
                                <span style={{ fontSize: '14px' }}>🔍</span>
                                <span>Natural language to SQL</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', fontSize: '13px', color: '#d4d4d4' }}>
                                <span style={{ fontSize: '14px' }}>📊</span>
                                <span>Schema-aware queries</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', fontSize: '13px', color: '#d4d4d4' }}>
                                <span style={{ fontSize: '14px' }}>⚡</span>
                                <span>Query optimization</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '24px', textAlign: 'left', maxWidth: '90%', marginLeft: 'auto', marginRight: 'auto' }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#9fb0c8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 1, margin: 0 }}>Try asking:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button onClick={() => setInput('Show me all users who signed up last month')} style={{ padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#d4d4d4', fontSize: '13px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                    Show me all users who signed up last month
                                </button>
                                <button onClick={() => setInput('What are the top 10 products by revenue?')} style={{ padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#d4d4d4', fontSize: '13px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                    What are the top 10 products by revenue?
                                </button>
                                <button onClick={() => setInput('Count orders grouped by status')} style={{ padding: '12px 14px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#d4d4d4', fontSize: '13px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                                    Count orders grouped by status
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} style={{
                            display: 'flex',
                            width: '100%',
                            marginBottom: '12px',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}>
                            <div style={{
                                maxWidth: '90%',
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                wordWrap: 'break-word',
                                background: msg.role === 'user' ? '#2a2a2a' : 'transparent',
                                color: msg.role === 'user' ? '#cccccc' : '#e6eef8',
                                border: msg.role === 'user' ? '1px solid #3a3a3a' : 'none',
                            }}>
                                {renderMessageContent(msg)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Section */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                borderTop: '1px solid #3a3a3a',
                background: '#1a1a1a',
                flexShrink: 0,
            }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything about your data..."
                        disabled={isLoading}
                        rows={1}
                        style={{
                            flex: 1,
                            resize: 'none',
                            fontSize: '13px',
                            padding: '10px 44px 10px 14px',
                            border: '1px solid #3a3a3a',
                            borderRadius: '10px',
                            lineHeight: '1.4',
                            fontFamily: 'inherit',
                            minHeight: '44px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            outline: 'none',
                            background: '#2a2a2a',
                            color: '#d4d4d4',
                            transition: '0.15s border-color, 0.15s box-shadow',
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading}
                        style={{
                            position: 'absolute',
                            right: '8px',
                            bottom: '8px',
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            background: '#4a9eff',
                            color: '#fff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                            opacity: isLoading || !input.trim() ? 0.6 : 1,
                        }}
                        title="Send message"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
