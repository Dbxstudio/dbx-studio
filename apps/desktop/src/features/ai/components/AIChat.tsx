import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, X, Loader2, Copy, Check, Play, AlertCircle, RotateCcw, Edit2, ThumbsUp, ThumbsDown, Plus, MoreVertical, Database, ChevronDown, ChevronRight } from 'lucide-react'
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

interface ToolCall {
    toolName: string
    rawToolName?: string
    args?: Record<string, unknown>
    sql?: string
    response?: string
    success?: boolean
    data?: unknown[]  // Actual result data for display
    timestamp?: number
}

interface StreamingBlock {
    type: 'thinking' | 'response' | 'tool' | 'sql' | 'error' | 'data'
    content?: string
    toolName?: string
    rawToolName?: string
    sql?: string
    args?: Record<string, unknown>
    response?: string
    success?: boolean
    data?: unknown[]  // For data results
}

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    sql?: string
    timestamp: Date
    isError?: boolean
    isStreaming?: boolean
    toolCalls?: ToolCall[]
    streamingBlocks?: StreamingBlock[]
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

/**
 * Get user-friendly display name for a tool
 */
function getToolDisplayName(toolName: string): string {
    const toolNameLower = (toolName || '').toLowerCase()

    if (toolNameLower === 'get_table_schema' || toolNameLower === 'inspect_database_schema') {
        return 'Reading Schema'
    } else if (toolNameLower === 'execute_sql_query') {
        return 'Executing Query'
    } else if (toolNameLower === 'generate_bar_graph' || toolNameLower.includes('graph') || toolNameLower.includes('chart')) {
        return 'Generating Graph'
    } else if (toolNameLower === 'get_enums') {
        return 'Getting Enums'
    } else if (toolNameLower === 'select_data') {
        return 'Selecting Data'
    }

    return toolName
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

    // Track expanded tool blocks (collapsed by default)
    const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({})

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

        // Create placeholder assistant message for streaming
        const assistantMessageId = (Date.now() + 1).toString()
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
            toolCalls: [],
            streamingBlocks: [],
        }

        setMessages(prev => [...prev, userMessage, assistantMessage])
        setInput('')
        setIsLoading(true)

        // Track streaming blocks locally - stores EVERYTHING in order (text + tools)
        let currentBlocks: StreamingBlock[] = []
        let currentToolCalls: ToolCall[] = []
        let currentTextContent = '' // Track current text accumulation

        try {
            // Update AI service configuration
            aiService.setProvider(selectedProvider)
            aiService.updateConfiguration({
                selectedProvider,
                selectedModelId,
                selectedModel: currentModel?.modelName,
                ...credentials
            })

            let fullContent = ''
            let charCount = 0

            // Send message with streaming
            await aiService.sendMessageStreaming(
                userMessage.content,
                // onChunk - update message as chunks arrive
                (chunk: string) => {
                    fullContent += chunk
                    charCount += chunk.length
                    currentTextContent += chunk

                    // Find or create a 'response' block for accumulating text
                    const lastBlock = currentBlocks[currentBlocks.length - 1]
                    if (lastBlock && lastBlock.type === 'response') {
                        // Update the last response block
                        currentBlocks = currentBlocks.map((block, idx) =>
                            idx === currentBlocks.length - 1
                                ? { ...block, content: currentTextContent }
                                : block
                        )
                    } else {
                        // Create new response block
                        currentBlocks = [...currentBlocks, { type: 'response', content: currentTextContent }]
                    }

                    // Update the streaming message
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: fullContent, isStreaming: true, streamingBlocks: [...currentBlocks], toolCalls: [...currentToolCalls] }
                            : msg
                    ))

                    // Estimate token count (rough approximation: ~4 chars per token)
                    setTokenCount(Math.ceil(charCount / 4))
                },
                // onComplete
                (fullMessage: string, sql?: string, data?: { toolCalls?: Array<{ toolName: string; args?: Record<string, unknown>; sql?: string; response?: string; success?: boolean; data?: unknown[] }> }) => {
                    // Final update with complete message
                    const finalToolCalls = data?.toolCalls || currentToolCalls

                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: fullMessage,
                                sql: sql,
                                isStreaming: false,
                                toolCalls: finalToolCalls,
                                streamingBlocks: currentBlocks, // Keep the blocks!
                            }
                            : msg
                    ))

                    // Final token count
                    setTokenCount(Math.ceil(fullMessage.length / 4))
                    setIsLoading(false)
                },
                // onError
                (error: string) => {
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? {
                                ...msg,
                                content: error,
                                isError: true,
                                isStreaming: false,
                            }
                            : msg
                    ))
                    setIsLoading(false)
                },
                // context
                {
                    connectionId,
                    externalConnectionId,
                    schema,
                    tables,
                    tableDetails,
                },
                // onToolCall - when a tool starts executing
                (toolName: string, args: Record<string, unknown>, toolUseId?: string) => {
                    // Reset text content since we're starting a tool call
                    currentTextContent = ''

                    const newBlock: StreamingBlock = {
                        type: 'tool',
                        toolName: getToolDisplayName(toolName),
                        rawToolName: toolName,
                        args,
                        sql: args?.query as string | undefined,
                    }
                    currentBlocks = [...currentBlocks, newBlock]

                    const newToolCall: ToolCall = {
                        toolName: getToolDisplayName(toolName),
                        rawToolName: toolName,
                        args,
                        sql: args?.query as string | undefined,
                        timestamp: Date.now(),
                    }
                    currentToolCalls = [...currentToolCalls, newToolCall]

                    // Update message with new tool block
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, streamingBlocks: [...currentBlocks], toolCalls: [...currentToolCalls] }
                            : msg
                    ))
                },
                // onToolResponse - when a tool completes
                (toolName: string, success: boolean, response: string, data?: unknown[], toolUseId?: string) => {
                    // Find the last tool block and update it with response
                    let foundTool = false
                    currentBlocks = currentBlocks.map((block, idx) => {
                        // Find the last tool block that doesn't have a response yet
                        if (!foundTool && block.type === 'tool' && block.success === undefined) {
                            foundTool = true
                            return { ...block, response, success, data }
                        }
                        return block
                    })

                    // Update tool calls
                    currentToolCalls = currentToolCalls.map((tc, idx) => {
                        if (idx === currentToolCalls.length - 1) {
                            return { ...tc, response, success, data }
                        }
                        return tc
                    })

                    // If we have data, add a data block for display
                    if (data && data.length > 0) {
                        const dataBlock: StreamingBlock = {
                            type: 'data',
                            data,
                            response,
                        }
                        currentBlocks = [...currentBlocks, dataBlock]
                    }

                    // Update message with response
                    setMessages(prev => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, streamingBlocks: [...currentBlocks], toolCalls: [...currentToolCalls] }
                            : msg
                    ))
                }
            )
        } catch (error) {
            setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.',
                        isError: true,
                        isStreaming: false,
                    }
                    : msg
            ))
            setIsLoading(false)
        }
    }, [input, isLoading, selectedProvider, selectedModelId, currentModel, connectionId, externalConnectionId, schema, tables, tableDetails, credentials, requiresCredentials, hasCredentials])

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

    // Toggle tool block expansion
    const toggleToolExpanded = useCallback((toolKey: string) => {
        setExpandedTools(prev => ({
            ...prev,
            [toolKey]: !prev[toolKey]
        }))
    }, [])

    if (!isOpen) return null

    const themeClass = isDarkTheme ? 'dark-theme' : 'light-theme'

    return (
        <div className={`workspace-ai-chat ${themeClass}`}>
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <img src="/assets/dbx-logo-white.png" alt="DBX Logo" className="ai-header-logo" />
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

                                {/* During streaming: show blocks in order (tools then response) */}
                                {/* After streaming: just show message.content (AI's final formatted response) */}
                                {message.role === 'assistant' && message.isStreaming && message.streamingBlocks && message.streamingBlocks.length > 0 ? (
                                    <div className="streaming-blocks">
                                        {message.streamingBlocks.map((block, idx) => (
                                            <div key={idx} className={`streaming-block ${block.type}`}>
                                                {block.type === 'response' && block.content && (
                                                    <div className="response-block">
                                                        <div className="message-text">
                                                            {renderFullMarkdown(block.content)}
                                                            {idx === message.streamingBlocks!.length - 1 && (
                                                                <span className="streaming-cursor">▊</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {block.type === 'tool' && (() => {
                                                    const toolKey = `${message.id}-tool-${idx}`
                                                    const isExpanded = expandedTools[toolKey] || false
                                                    return (
                                                        <div className={`tool-block ${isExpanded ? 'expanded' : 'collapsed'}`}>
                                                            <div
                                                                className="tool-header clickable"
                                                                onClick={() => toggleToolExpanded(toolKey)}
                                                            >
                                                                <span className="tool-expand-icon">
                                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                </span>
                                                                <span className="tool-icon">🔧</span>
                                                                <span className="tool-name">{block.toolName || block.rawToolName}</span>
                                                                {block.success === undefined && (
                                                                    <Loader2 size={14} className="spin" />
                                                                )}
                                                                {block.success === true && (
                                                                    <Check size={14} className="tool-success" />
                                                                )}
                                                                {block.success === false && (
                                                                    <AlertCircle size={14} className="tool-error" />
                                                                )}
                                                            </div>
                                                            {isExpanded && (
                                                                <div className="tool-details">
                                                                    {block.sql && (
                                                                        <div className="tool-sql">
                                                                            <pre className="sql-code compact">
                                                                                <code>{highlightSQL(block.sql)}</code>
                                                                            </pre>
                                                                        </div>
                                                                    )}
                                                                    {block.response && (
                                                                        <div className="tool-response">
                                                                            <span className="tool-response-text">{block.response}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })()}
                                                {block.type === 'data' && block.data && block.data.length > 0 && (
                                                    <div className="data-block">
                                                        <div className="data-header">
                                                            <span className="data-icon">📊</span>
                                                            <span>Query Results ({block.data.length} row{block.data.length !== 1 ? 's' : ''})</span>
                                                        </div>
                                                        <div className="data-table-wrapper">
                                                            <table className="data-table">
                                                                <thead>
                                                                    <tr>
                                                                        {Object.keys(block.data[0] as Record<string, unknown>).map(key => (
                                                                            <th key={key}>{key}</th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(block.data as Record<string, unknown>[]).slice(0, 10).map((row, rowIdx) => (
                                                                        <tr key={rowIdx}>
                                                                            {Object.values(row).map((val, colIdx) => (
                                                                                <td key={colIdx}>{String(val ?? '')}</td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            {block.data.length > 10 && (
                                                                <div className="data-more">... and {block.data.length - 10} more rows</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="message-text">
                                        {renderFullMarkdown(message.content)}
                                    </div>
                                )}

                                {message.sql && (
                                    <div className="message-sql">
                                        <div className="sql-header">
                                            <span>SQL</span>
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

                {isLoading && (
                    <div className="message assistant">
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

            {/* Input - Copilot Style with Inline Send Button */}
            <div className="ai-input-section">
                <div className="ai-connection-info">
                    <div className="ai-db-indicator">
                        <Database size={14} />
                        <span className="connection-status-dot"></span>
                        {connectionName && <span className="connection-name">{connectionName}</span>}
                    </div>
                </div>
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
