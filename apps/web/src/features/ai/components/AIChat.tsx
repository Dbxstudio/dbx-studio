import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, X, Loader2, Copy, Check, Play, AlertCircle, RotateCcw, Edit2, ThumbsUp, ThumbsDown, Plus, MoreVertical, Database, ChevronDown, ChevronRight, FileSearch, BarChart3 } from 'lucide-react'
import aiService from '../services/aiService'
import {
    PROVIDERS,
    MODELS,
    getModelsByProvider,
    getProviderById,
    providerRequiresCredentials,
    getCredentialFieldsForProvider
} from '../services/aiConfig'
import { HierarchicalSelector } from './HierarchicalSelector'
import { renderFullMarkdown } from '../utils/fullMarkdownRenderer'
import { highlightSQL } from '../utils/sqlHighlighter'
import { autoSaveMessages, getCurrentSessionId, createNewSession, loadSession } from '../services/aiChatStorage'
import './ai-chat.css'
import './hierarchical-selector.css'

// Streaming block types for tool display
interface StreamingBlock {
    type: 'thinking' | 'tool' | 'response' | 'sql' | 'error'
    content?: string
    toolName?: string
    args?: Record<string, unknown>
    response?: string
    success?: boolean
    sql?: string
    data?: unknown // Tool result data (e.g., query results)
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    sql?: string
    timestamp: Date
    isError?: boolean
    isStreaming?: boolean
    streamingBlocks?: StreamingBlock[] // Save streaming blocks with message
}

/**
 * Get user-friendly tool display name
 */
function getToolDisplayName(toolName: string): string {
    const toolNameLower = (toolName || '').toLowerCase()

    if (toolNameLower === 'get_table_schema' || toolNameLower === 'inspect_database_schema') {
        return 'Reading Schema'
    } else if (toolNameLower === 'execute_sql_query') {
        return 'Executing Query'
    } else if (toolNameLower === 'generate_bar_graph' || toolNameLower.includes('graph') || toolNameLower.includes('chart')) {
        return 'Generating Visualization'
    } else if (toolNameLower === 'get_enums') {
        return 'Getting Enums'
    } else if (toolNameLower === 'select_data') {
        return 'Selecting Data'
    }

    return toolName
}

/**
 * Get icon for tool type
 */
function getToolIcon(toolName: string) {
    const toolNameLower = (toolName || '').toLowerCase()

    if (toolNameLower === 'get_table_schema' || toolNameLower === 'inspect_database_schema') {
        return <FileSearch size={14} />
    } else if (toolNameLower === 'execute_sql_query') {
        return <Database size={14} />
    } else if (toolNameLower === 'generate_bar_graph' || toolNameLower.includes('graph') || toolNameLower.includes('chart')) {
        return <BarChart3 size={14} />
    }

    return <Database size={14} />
}

interface WorksheetInfo {
    id: string
    title: string
}

interface AIChatProps {
    isOpen: boolean
    onClose: () => void
    onRunQuery?: (sql: string) => void
    connectionId?: string
    externalConnectionId?: string // Server-side connection ID for AI
    schema?: string
    tables?: string[]
    tableDetails?: {
        tableName: string
        schema?: string
        columns?: Array<{ name: string; type?: string; nullable?: boolean; isPrimaryKey?: boolean }>
        sampleRows?: Array<Record<string, any>>
    }
    isDarkTheme?: boolean
    worksheets?: WorksheetInfo[]
    activeWorksheetId?: string
    onSelectWorksheet?: (worksheetId: string) => void
    connectionName?: string
}

/**
 * Format timestamp as HH:MM
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Extract SQL from response text
 */
function extractSQL(text: string): string | null {
    if (!text) return null

    // Try to extract from ```sql ... ``` blocks
    const sqlBlockMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i)
    if (sqlBlockMatch && sqlBlockMatch[1]) {
        return sqlBlockMatch[1].trim()
    }

    // Try to extract from ``` ... ``` blocks
    const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch && codeBlockMatch[1]) {
        const content = codeBlockMatch[1].trim()
        // Check if it looks like SQL
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s/i.test(content)) {
            return content
        }
    }

    // Try to find SQL statement in text
    const sqlMatch = text.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|WITH)[\s\S]*?;/i)
    if (sqlMatch) {
        return sqlMatch[0].trim()
    }

    return null
}

export function AIChat({ isOpen, onClose, onRunQuery, connectionId, externalConnectionId, schema, tables, tableDetails, isDarkTheme = true, worksheets = [], activeWorksheetId, onSelectWorksheet, connectionName }: AIChatProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({})
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [tokenCount, setTokenCount] = useState<number>(0)

    // Streaming state for tool display
    const [isStreaming, setIsStreaming] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [streamingBlocks, setStreamingBlocks] = useState<StreamingBlock[]>([])
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})
    const streamingBlocksRef = useRef<StreamingBlock[]>([])

    // Schema/Table selection state
    const [selectedSchemaId, setSelectedSchemaId] = useState<string | number>('')
    const [selectedTableId, setSelectedTableId] = useState<string | number>('')
    const [schemas, setSchemas] = useState<Array<{ schema_id: string | number, schema_name: string }>>([])
    const [loadingSchemas, setLoadingSchemas] = useState(false)
    const [loadingTables, setLoadingTables] = useState(false)

    // AI Settings
    const [selectedProvider, setSelectedProvider] = useState(
        localStorage.getItem('ai_selected_provider') || 'openai'
    )
    const [selectedModelId, setSelectedModelId] = useState(
        parseInt(localStorage.getItem('ai_selected_model_id') || '201', 10) // GPT-4o
    )

    // Credentials state
    const [credentials, setCredentials] = useState({
        AWS_ACCESS_KEY_ID: localStorage.getItem('ai_aws_access_key_id') || '',
        AWS_SECRET_ACCESS_KEY: localStorage.getItem('ai_aws_secret_access_key') || '',
        AWS_REGION: localStorage.getItem('ai_aws_region') || 'us-east-1',
        OPENAI_API_KEY: localStorage.getItem('ai_openai_api_key') || '',
        ANTHROPIC_API_KEY: localStorage.getItem('ai_anthropic_api_key') || '',
    })

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const [currentSessionId, setCurrentSessionId] = useState<string>('')

    const providerModels = useMemo(() => getModelsByProvider(selectedProvider), [selectedProvider])
    const currentProvider = getProviderById(selectedProvider)
    const currentModel = MODELS.find(m => m.modelId === selectedModelId)
    const requiresCredentials = providerRequiresCredentials(selectedProvider)
    const credentialFields = getCredentialFieldsForProvider(selectedProvider)

    // Check if credentials are configured
    const hasCredentials = useMemo(() => {
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

    // Load chat history on mount
    useEffect(() => {
        const sessionId = getCurrentSessionId()
        setCurrentSessionId(sessionId)

        const session = loadSession(sessionId)
        if (session && session.messages.length > 0) {
            setMessages(session.messages)
        }
    }, [])

    // Auto-save messages when they change
    useEffect(() => {
        if (messages.length > 0) {
            autoSaveMessages(messages, connectionId, schema)
        }
    }, [messages, connectionId, schema])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
        }
    }, [isOpen])

    // Update model when provider changes
    useEffect(() => {
        const models = getModelsByProvider(selectedProvider)
        if (!models.find(m => m.modelId === selectedModelId) && models.length > 0) {
            setSelectedModelId(models[0].modelId)
        }
    }, [selectedProvider, selectedModelId])

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        // Check credentials for providers that require them
        if (requiresCredentials && !hasCredentials) {
            setShowSettings(true)
            return
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)
        setIsStreaming(true)

        // Create placeholder assistant message for streaming
        const assistantMessageId = (Date.now() + 1).toString()
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        }

        // Add assistant message to show streaming immediately
        setMessages(prev => [...prev, assistantMessage])

        // Reset streaming state for new message
        setStreamingBlocks([])
        setStreamingContent('')
        streamingBlocksRef.current = []
        setExpandedTools({}) // Reset expanded state for new conversation

        try {
            // Update AI service configuration
            aiService.setProvider(selectedProvider)
            aiService.updateConfiguration({
                selectedProvider,
                selectedModelId,
                selectedModel: currentModel?.modelName,
                ...credentials
            })

            // Use streaming endpoint with tool callbacks
            await aiService.sendMessageStreamingWithTools(
                userMessage.content,
                {
                    onChunk: (chunk) => {
                        setStreamingContent(prev => prev + chunk)
                        // Update or add response block
                        setStreamingBlocks(prev => {
                            const lastBlock = prev[prev.length - 1]
                            if (lastBlock?.type === 'response') {
                                const newBlocks = [...prev]
                                newBlocks[newBlocks.length - 1] = {
                                    ...lastBlock,
                                    content: (lastBlock.content || '') + chunk
                                }
                                streamingBlocksRef.current = newBlocks
                                return newBlocks
                            } else {
                                const newBlocks = [...prev, { type: 'response' as const, content: chunk }]
                                streamingBlocksRef.current = newBlocks
                                return newBlocks
                            }
                        })

                        // Also update the assistant message content for fallback display
                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? { ...msg, content: msg.content + chunk }
                                : msg
                        ))
                    },
                    onToolCall: (toolName, args) => {
                        setStreamingBlocks(prev => {
                            const newBlock: StreamingBlock = {
                                type: 'tool',
                                toolName,
                                args,
                                content: `Calling ${getToolDisplayName(toolName)}...`,
                                // Extract SQL from execute_sql_query tool
                                sql: toolName === 'execute_sql_query' && args?.query ? String(args.query) : undefined
                            }
                            const newBlocks = [...prev, newBlock]
                            streamingBlocksRef.current = newBlocks
                            return newBlocks
                        })
                    },
                    onToolResponse: (toolName, success, response, data) => {
                        setStreamingBlocks(prev => {
                            const newBlocks = [...prev]
                            // Find the last tool block with this name and update it
                            for (let i = newBlocks.length - 1; i >= 0; i--) {
                                if (newBlocks[i].type === 'tool' && newBlocks[i].toolName === toolName && !newBlocks[i].response) {
                                    newBlocks[i] = {
                                        ...newBlocks[i],
                                        success,
                                        response,
                                        data, // Store the actual result data
                                        content: success ? `${getToolDisplayName(toolName)} completed` : `${getToolDisplayName(toolName)} failed`
                                    }
                                    break
                                }
                            }
                            streamingBlocksRef.current = newBlocks
                            return newBlocks
                        })
                    },
                    onComplete: (fullMessage, sql) => {
                        setIsStreaming(false)
                        setIsLoading(false)

                        // Extract SQL from tool blocks if not provided in response
                        let finalSQL = sql
                        if (!finalSQL) {
                            // Look for SQL in execute_sql_query tool blocks
                            const sqlTool = streamingBlocksRef.current.find(
                                b => b.type === 'tool' && b.toolName === 'execute_sql_query' && b.sql
                            )
                            if (sqlTool?.sql) {
                                finalSQL = sqlTool.sql
                            }
                        }

                        // Update the existing assistant message instead of creating a new one
                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? {
                                    ...msg,
                                    content: fullMessage,
                                    sql: finalSQL,
                                    isStreaming: false,
                                    streamingBlocks: [...streamingBlocksRef.current] // Preserve tools for display
                                }
                                : msg
                        ))

                        // Don't clear streaming blocks immediately - they'll be preserved in the message
                        // Only clear when starting a new message
                    },
                    onError: (error) => {
                        setIsStreaming(false)
                        setIsLoading(false)

                        // Add error to streaming blocks
                        setStreamingBlocks(prev => {
                            const newBlocks = [...prev, { type: 'error' as const, content: error }]
                            streamingBlocksRef.current = newBlocks
                            return newBlocks
                        })

                        // Update the existing assistant message with error instead of creating new one
                        setMessages(prev => prev.map(msg =>
                            msg.id === assistantMessageId
                                ? {
                                    ...msg,
                                    content: error,
                                    isError: true,
                                    isStreaming: false,
                                    streamingBlocks: [...streamingBlocksRef.current]
                                }
                                : msg
                        ))
                    }
                },
                {
                    connectionId,
                    externalConnectionId,
                    schema,
                    tables,
                    tableDetails,
                }
            )
        } catch (error) {
            setIsStreaming(false)
            setIsLoading(false)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                isError: true,
            }
            setMessages(prev => [...prev, errorMessage])
            setStreamingBlocks([])
            setStreamingContent('')
        }
    }, [input, isLoading, isStreaming, selectedProvider, selectedModelId, currentModel, connectionId, externalConnectionId, schema, tables, credentials, requiresCredentials, hasCredentials])

    const handleCopySQL = async (sql: string, messageId: string) => {
        await navigator.clipboard.writeText(sql)
        setCopiedId(messageId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleCopyMessage = async (content: string, messageId: string) => {
        await navigator.clipboard.writeText(content)
        setCopiedId(messageId)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleRetry = useCallback((messageContent: string) => {
        setInput(messageContent)
        inputRef.current?.focus()
    }, [])

    const handleEdit = useCallback((messageId: string, content: string) => {
        setEditingMessageId(messageId)
        setInput(content)
        inputRef.current?.focus()
    }, [])

    const handleFeedback = useCallback((messageId: string, type: 'up' | 'down') => {
        setFeedbackGiven(prev => ({
            ...prev,
            [messageId]: prev[messageId] === type ? undefined as any : type
        }))
        // TODO: Send feedback to backend
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const handleSaveSettings = useCallback(() => {
        // Save to localStorage
        localStorage.setItem('ai_selected_provider', selectedProvider)
        localStorage.setItem('ai_selected_model_id', String(selectedModelId))
        localStorage.setItem('ai_aws_access_key_id', credentials.AWS_ACCESS_KEY_ID)
        localStorage.setItem('ai_aws_secret_access_key', credentials.AWS_SECRET_ACCESS_KEY)
        localStorage.setItem('ai_aws_region', credentials.AWS_REGION)
        localStorage.setItem('ai_openai_api_key', credentials.OPENAI_API_KEY)
        localStorage.setItem('ai_anthropic_api_key', credentials.ANTHROPIC_API_KEY)

        // Update AI service
        aiService.setProvider(selectedProvider)
        aiService.updateConfiguration({
            selectedProvider,
            selectedModelId,
            selectedModel: currentModel?.modelName,
            ...credentials
        })

        // Save to server
        aiService.setCredentials({
            selectedProvider,
            selectedModelId,
            selectedModel: currentModel?.modelName,
            ...credentials
        })

        setShowSettings(false)
    }, [selectedProvider, selectedModelId, currentModel, credentials])

    const handleClearChat = useCallback(() => {
        setMessages([])
        const newSessionId = createNewSession()
        setCurrentSessionId(newSessionId)
    }, [])

    if (!isOpen) return null

    const themeClass = isDarkTheme ? 'dark-theme' : 'light-theme'

    return (
        <div className={`workspace-ai-chat ${themeClass}`}>
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <h3>Copilot Chat</h3>
                </div>
                <div className="ai-header-actions">
                    {messages.length > 0 && (
                        <button
                            className="ai-header-btn"
                            onClick={handleClearChat}
                            title="New Chat"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}
                    <button
                        className="ai-header-btn"
                        onClick={handleClearChat}
                        title="New Chat"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        className="ai-header-btn"
                        onClick={() => setShowSettings(!showSettings)}
                        title="Menu"
                    >
                        <MoreVertical size={14} />
                    </button>
                    <button className="ai-close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="ai-settings-panel">
                    <div className="ai-settings-group">
                        <label>Provider</label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                        >
                            {PROVIDERS.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {!p.requiresCredentials ? '(No API Key)' : ''}
                                </option>
                            ))}
                        </select>
                        <span className="ai-settings-hint">{currentProvider?.description}</span>
                    </div>

                    <div className="ai-settings-group">
                        <label>Model</label>
                        <select
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(parseInt(e.target.value, 10))}
                        >
                            {providerModels.map(m => (
                                <option key={m.modelId} value={m.modelId}>
                                    {m.label}{m.isThinking ? ' (Extended Thinking)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Provider-specific credentials */}
                    {selectedProvider === 'bedrock' && (
                        <div className="ai-credentials-section">
                            <div className="ai-settings-group">
                                <label>AWS Access Key ID</label>
                                <input
                                    type="text"
                                    value={credentials.AWS_ACCESS_KEY_ID}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_ACCESS_KEY_ID: e.target.value }))}
                                    placeholder="AKIA..."
                                />
                            </div>
                            <div className="ai-settings-group">
                                <label>AWS Secret Access Key</label>
                                <input
                                    type="password"
                                    value={credentials.AWS_SECRET_ACCESS_KEY}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_SECRET_ACCESS_KEY: e.target.value }))}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="ai-settings-group">
                                <label>AWS Region</label>
                                <input
                                    type="text"
                                    value={credentials.AWS_REGION}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, AWS_REGION: e.target.value }))}
                                    placeholder="us-east-1"
                                />
                            </div>
                        </div>
                    )}

                    {selectedProvider === 'openai' && (
                        <div className="ai-credentials-section">
                            <div className="ai-settings-group">
                                <label>OpenAI API Key</label>
                                <input
                                    type="password"
                                    value={credentials.OPENAI_API_KEY}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, OPENAI_API_KEY: e.target.value }))}
                                    placeholder="sk-..."
                                />
                            </div>
                        </div>
                    )}

                    {selectedProvider === 'claude' && (
                        <div className="ai-credentials-section">
                            <div className="ai-settings-group">
                                <label>Anthropic API Key</label>
                                <input
                                    type="password"
                                    value={credentials.ANTHROPIC_API_KEY}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, ANTHROPIC_API_KEY: e.target.value }))}
                                    placeholder="sk-ant-..."
                                />
                            </div>
                        </div>
                    )}

                    {selectedProvider === 'dbx-agent' && (
                        <div className="ai-info-box">
                            <AlertCircle size={14} />
                            <span>DBX Agent uses server-side processing. No API keys required!</span>
                        </div>
                    )}

                    <div className="ai-settings-actions">
                        <button className="ai-settings-save" onClick={handleSaveSettings}>
                            Save Settings
                        </button>
                        <button className="ai-settings-cancel" onClick={() => setShowSettings(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Credential Warning */}
            {requiresCredentials && !hasCredentials && !showSettings && (
                <div className="ai-credential-warning">
                    <AlertCircle size={16} />
                    <span>
                        {currentProvider?.name} requires API credentials.
                        <button onClick={() => setShowSettings(true)}>Configure now</button>
                    </span>
                </div>
            )}

            {/* Content */}
            <div className="ai-content">
                {messages.length === 0 ? (
                    <div className="ai-welcome">
                        <span className="welcome-icon">✨</span>
                        <div className="welcome-title">AI SQL Assistant</div>
                        <p className="welcome-description">
                            Describe what data you need and I'll generate SQL queries for you.
                        </p>
                        <div className="ai-features">
                            <div className="feature-item">
                                <span className="feature-icon">🔍</span>
                                <span>Natural language to SQL</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">📊</span>
                                <span>Schema-aware queries</span>
                            </div>
                            <div className="feature-item">
                                <span className="feature-icon">⚡</span>
                                <span>Query optimization</span>
                            </div>
                        </div>
                        <div className="ai-examples">
                            <p className="examples-title">Try asking:</p>
                            <div className="example-queries">
                                <button
                                    className="example-query"
                                    onClick={() => setInput('Show me all users who signed up last month')}
                                >
                                    Show me all users who signed up last month
                                </button>
                                <button
                                    className="example-query"
                                    onClick={() => setInput('What are the top 10 products by revenue?')}
                                >
                                    What are the top 10 products by revenue?
                                </button>
                                <button
                                    className="example-query"
                                    onClick={() => setInput('Count orders grouped by status')}
                                >
                                    Count orders grouped by status
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    messages.map(message => (
                        <div key={message.id} className={`message ${message.role} ${message.isError ? 'error' : ''} ${message.isStreaming ? 'streaming' : ''}`}>
                            <div className="message-content">
                                {message.isError && (
                                    <div className="error-header">
                                        <AlertCircle size={16} />
                                        <span>Error</span>
                                    </div>
                                )}

                                {/* Show streaming blocks FIRST for assistant messages (real-time tool display) */}
                                {/* Also show preserved streamingBlocks for completed messages in the same position */}
                                {message.role === 'assistant' && (
                                    (message.isStreaming && streamingBlocks.length > 0) ||
                                    (!message.isStreaming && message.streamingBlocks && message.streamingBlocks.length > 0)
                                ) && (
                                        <div className="streaming-blocks">
                                            {(message.isStreaming ? streamingBlocks : message.streamingBlocks || []).map((block, idx) => {
                                                if (block.type === 'tool') {
                                                    const toolKey = message.isStreaming ? `streaming-tool-${idx}` : `message-${message.id}-tool-${idx}`
                                                    const isExpanded = expandedTools[toolKey] === true // Default collapsed
                                                    const isExecuteQuery = block.toolName === 'execute_sql_query'
                                                    const executedSQL = isExecuteQuery && block.args?.query ? String(block.args.query) : block.sql

                                                    return (
                                                        <div key={idx} className={`tool-block ${!message.isStreaming ? 'completed' : ''}`}>
                                                            <div
                                                                className={`tool-header ${block.success === undefined ? 'pending' : block.success ? 'success' : 'error'}`}
                                                                onClick={() => setExpandedTools(prev => ({ ...prev, [toolKey]: !isExpanded }))}
                                                            >
                                                                <div className="tool-info">
                                                                    {getToolIcon(block.toolName || '')}
                                                                    <span className="tool-name">{getToolDisplayName(block.toolName || '')}</span>
                                                                    {block.success === undefined && (
                                                                        <Loader2 size={12} className="spin tool-spinner" />
                                                                    )}
                                                                    {block.success === true && (
                                                                        <Check size={12} className="tool-success-icon" />
                                                                    )}
                                                                </div>
                                                                <span className="tool-expand-icon">
                                                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                </span>
                                                            </div>
                                                            {isExpanded && (
                                                                <div className="tool-details">
                                                                    {/* Show SQL prominently for execute_sql_query */}
                                                                    {executedSQL && (
                                                                        <div className="tool-sql-section">
                                                                            <div className="tool-sql-label">SQL Query</div>
                                                                            <pre className="tool-sql-content">
                                                                                <code>{highlightSQL(executedSQL)}</code>
                                                                            </pre>
                                                                            {/* Show copy/run buttons for completed tools */}
                                                                            {!message.isStreaming && (
                                                                                <div className="tool-sql-actions">
                                                                                    <button
                                                                                        className="sql-btn"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation()
                                                                                            handleCopySQL(executedSQL, `${message.id}-tool-${idx}`)
                                                                                        }}
                                                                                        title="Copy SQL"
                                                                                    >
                                                                                        {copiedId === `${message.id}-tool-${idx}` ? (
                                                                                            <Check size={14} />
                                                                                        ) : (
                                                                                            <Copy size={14} />
                                                                                        )}
                                                                                    </button>
                                                                                    {onRunQuery && (
                                                                                        <button
                                                                                            className="sql-btn run"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation()
                                                                                                onRunQuery(executedSQL)
                                                                                            }}
                                                                                            title="Run Query"
                                                                                        >
                                                                                            <Play size={12} />
                                                                                            Run
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* Show other arguments for non-SQL tools */}
                                                                    {block.args && !executedSQL && (
                                                                        <div className="tool-args">
                                                                            <span className="tool-args-label">Arguments:</span>
                                                                            <pre className="tool-args-content">
                                                                                {String(JSON.stringify(block.args, null, 2))}
                                                                            </pre>
                                                                        </div>
                                                                    )}
                                                                    {block.response && (
                                                                        <div className="tool-response">
                                                                            <span className="tool-response-label">Result:</span>
                                                                            <span className={`tool-response-status ${block.success ? 'success' : 'error'}`}>
                                                                                {block.response}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {/* Show actual query result data */}
                                                                    {block.data && Array.isArray(block.data) && block.data.length > 0 && (
                                                                        <div className="tool-result-data">
                                                                            <span className="tool-result-label">Data:</span>
                                                                            <pre className="tool-result-content">
                                                                                {JSON.stringify(block.data, null, 2)}
                                                                            </pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                }
                                                return null
                                            })}
                                        </div>
                                    )}

                                {/* Show message text */}
                                <div className="message-text">
                                    {message.content ? renderFullMarkdown(message.content) : (
                                        message.isStreaming && streamingBlocks.length === 0 ? (
                                            <div className="typing-indicator">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        ) : null
                                    )}
                                    {message.isStreaming && message.content && <span className="streaming-cursor">▊</span>}
                                </div>

                                {message.sql && !message.isStreaming && (
                                    <div className="message-sql">
                                        <div className="sql-header">
                                            <span>Generated SQL</span>
                                            <div className="sql-actions">
                                                <button
                                                    className="sql-btn"
                                                    onClick={() => handleCopySQL(message.sql!, message.id)}
                                                    title="Copy SQL"
                                                >
                                                    {copiedId === message.id ? (
                                                        <Check size={14} />
                                                    ) : (
                                                        <Copy size={14} />
                                                    )}
                                                </button>
                                                {onRunQuery && (
                                                    <button
                                                        className="sql-btn run"
                                                        onClick={() => onRunQuery(message.sql!)}
                                                        title="Run Query"
                                                    >
                                                        <Play size={12} />
                                                        Run
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <pre className="sql-code">
                                            <code>{highlightSQL(message.sql)}</code>
                                        </pre>
                                    </div>
                                )}

                                {/* Message Actions */}
                                <div className="message-actions">
                                    {message.role === 'user' ? (
                                        <>
                                            <button
                                                className="action-btn"
                                                onClick={() => handleEdit(message.id, message.content)}
                                                title="Edit"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="action-btn"
                                                onClick={() => handleRetry(message.content)}
                                                title="Retry"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="action-btn"
                                                onClick={() => handleCopyMessage(message.content, message.id)}
                                                title="Copy"
                                            >
                                                {copiedId === message.id ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                            </button>
                                            <button
                                                className={`action-btn ${feedbackGiven[message.id] === 'up' ? 'active' : ''}`}
                                                onClick={() => handleFeedback(message.id, 'up')}
                                                title="Good response"
                                            >
                                                <ThumbsUp size={14} />
                                            </button>
                                            <button
                                                className={`action-btn ${feedbackGiven[message.id] === 'down' ? 'active' : ''}`}
                                                onClick={() => handleFeedback(message.id, 'down')}
                                                title="Bad response"
                                            >
                                                <ThumbsDown size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                <span className="message-time">{formatTime(message.timestamp)}</span>
                            </div>
                        </div>
                    ))
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input - Copilot Style with Inline Send Button */}
            <div className="ai-input-section">
                <div className="input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="ai-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={requiresCredentials && !hasCredentials
                            ? 'Configure credentials to start chatting...'
                            : 'Ask your queries...'}
                        disabled={isLoading || (requiresCredentials && !hasCredentials)}
                        rows={1}
                    />
                    <button
                        className="ai-send-btn"
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading || (requiresCredentials && !hasCredentials)}
                        title="Send message"
                    >
                        {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    </button>
                </div>
                <div className="ai-bottom-selectors">
                    <div className="ai-worksheet-selector">
                        <select
                            value={activeWorksheetId || ''}
                            onChange={(e) => onSelectWorksheet?.(e.target.value)}
                            disabled={worksheets.length === 0}
                        >
                            {worksheets.length === 0 ? (
                                <option value="">No worksheets</option>
                            ) : (
                                worksheets.map(ws => (
                                    <option key={ws.id} value={ws.id}>
                                        {ws.title}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>
                    <div className="ai-model-selector-bottom">
                        <select
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(parseInt(e.target.value, 10))}
                        >
                            {providerModels.map(m => (
                                <option key={m.modelId} value={m.modelId}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}
