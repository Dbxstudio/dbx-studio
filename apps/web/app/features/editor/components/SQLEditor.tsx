import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react'
import { FaPlay, FaStop, FaSave, FaDatabase, FaChevronDown, FaTable } from 'react-icons/fa'
import { BiLogoPostgresql } from 'react-icons/bi'
import { GrMysql } from 'react-icons/gr'
import { SiSqlite, SiMariadb, SiSnowflake, SiClickhouse } from 'react-icons/si'
import { BsStars } from 'react-icons/bs'
import { TbSchema } from 'react-icons/tb'
import './sql-editor.css'

interface Connection {
    id: string
    name: string
    type: string
}

interface TableInfo {
    name: string
    columns: { name: string; type: string }[]
}

interface SchemaInfo {
    name: string
    tables: TableInfo[]
}

interface SQLEditorProps {
    value: string
    onChange: (value: string) => void
    onRun?: () => void
    onSave?: () => void
    isRunning?: boolean
    // Connection selection
    connections?: Connection[]
    selectedConnectionId?: string
    onSelectConnection?: (connectionId: string) => void
    // Database selection
    databases?: { id: string; name: string }[]
    selectedDatabaseId?: string
    onSelectDatabase?: (databaseId: string) => void
    // Schema selection
    schemas?: SchemaInfo[]
    selectedSchema?: string
    onSelectSchema?: (schema: string) => void
    // Table/column data for autocomplete (deprecated - use schemas instead)
    tables?: TableInfo[]
}

// Database icon mapper
const getDatabaseIcon = (dialect: string, size = 14) => {
    if (!dialect) return <FaDatabase size={size} />

    const dialectLower = dialect.toLowerCase()

    if (dialectLower === 'postgres' || dialectLower === 'postgresql') {
        return <BiLogoPostgresql size={size} className="db-icon postgres" />
    } else if (dialectLower === 'sqlite' || dialectLower === 'sqlite3') {
        return <SiSqlite size={size} className="db-icon sqlite" />
    } else if (dialectLower === 'mariadb') {
        return <SiMariadb size={size} className="db-icon mariadb" />
    } else if (dialectLower === 'mysql') {
        return <GrMysql size={size} className="db-icon mysql" />
    } else if (dialectLower === 'snowflake') {
        return <SiSnowflake size={size - 2} className="db-icon snowflake" />
    } else if (dialectLower === 'clickhouse') {
        return <SiClickhouse size={size} className="db-icon clickhouse" />
    }

    return <FaDatabase size={size} className="db-icon default" />
}

export function SQLEditor({
    value,
    onChange,
    onRun,
    onSave,
    isRunning = false,
    connections = [],
    selectedConnectionId,
    onSelectConnection,
    databases = [],
    selectedDatabaseId,
    onSelectDatabase,
    schemas = [],
    selectedSchema,
    onSelectSchema,
    tables = [],
}: SQLEditorProps) {
    const editorRef = useRef<any>(null)
    const onRunRef = useRef(onRun)
    const onSaveRef = useRef(onSave)
    const [showConnectionDropdown, setShowConnectionDropdown] = useState(false)
    const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false)
    const [showSchemaDropdown, setShowSchemaDropdown] = useState(false)

    // Keep refs updated with latest callbacks
    useEffect(() => {
        onRunRef.current = onRun
    }, [onRun])

    useEffect(() => {
        onSaveRef.current = onSave
    }, [onSave])

    // Get selected connection
    const selectedConnection = useMemo(() =>
        connections.find(c => c.id === selectedConnectionId),
        [connections, selectedConnectionId]
    )

    // Get all tables (from tables prop or from schemas)
    const allTables = useMemo(() => {
        // If schemas are provided and have tables, use them
        if (schemas.length > 0) {
            const currentSchema = schemas.find(s => s.name === selectedSchema) || schemas[0]
            if (currentSchema?.tables && currentSchema.tables.length > 0) {
                return currentSchema.tables
            }
        }
        // Fallback to tables prop (always use if schemas don't have tables)
        return tables
    }, [schemas, selectedSchema, tables])

    // Get all schema names for suggestions
    const schemaNames = useMemo(() =>
        schemas.map(s => s.name),
        [schemas]
    )

    // SQL keywords for autocomplete
    const sqlKeywords = useMemo(() => [
        'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
        'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON',
        'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'ALL',
        'CREATE', 'TABLE', 'VIEW', 'INDEX', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'CONSTRAINT',
        'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL', 'AS',
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'NULLIF', 'CAST',
        'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
        'EXISTS', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
        'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
        'WITH', 'RECURSIVE', 'RETURNING',
        'TRUNCATE', 'VACUUM', 'ANALYZE', 'EXPLAIN',
        'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
        'GRANT', 'REVOKE', 'ROLE', 'USER',
    ], [])

    const handleEditorMount: OnMount = useCallback((editor, monaco) => {
        editorRef.current = editor

        // Dispose any existing completion provider before registering a new one
        if ((window as any).__sqlCompletionDisposable) {
            (window as any).__sqlCompletionDisposable.dispose()
        }

        // Register completion provider with table/column/schema suggestions
        const disposable = monaco.languages.registerCompletionItemProvider('sql', {
            triggerCharacters: ['.', ' ', '\n'],
            provideCompletionItems: (model: any, position: any) => {
                const word = model.getWordUntilPosition(position)
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                }

                // Get the text before the cursor to determine context
                const lineContent = model.getLineContent(position.lineNumber)
                const textBeforeCursor = lineContent.substring(0, position.column - 1).toLowerCase()

                // Check if we're after FROM, JOIN, or other table-context keywords
                const isTableContext = /(?:from|join|update|into|table)\s+\w*$/i.test(textBeforeCursor)
                const isSchemaContext = /(?:schema|set\s+search_path)\s*=?\s*\w*$/i.test(textBeforeCursor)
                const isDotContext = textBeforeCursor.endsWith('.')

                // Use a Map to deduplicate suggestions by label
                const suggestionsMap = new Map<string, any>()

                // If after a dot, suggest columns for the table before the dot
                if (isDotContext) {
                    const match = textBeforeCursor.match(/(\w+)\.$/);
                    if (match) {
                        const tableName = match[1]
                        // Find in allTables
                        const table = allTables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
                        if (table) {
                            table.columns.forEach(col => {
                                suggestionsMap.set(col.name, {
                                    label: col.name,
                                    kind: monaco.languages.CompletionItemKind.Field,
                                    insertText: col.name,
                                    detail: col.type,
                                    sortText: `0_${col.name}`,
                                    range,
                                })
                            })
                        }
                        // Also check if it's a schema name, and suggest tables
                        const schema = schemas.find(s => s.name.toLowerCase() === tableName.toLowerCase())
                        if (schema) {
                            schema.tables.forEach(t => {
                                suggestionsMap.set(t.name, {
                                    label: t.name,
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    insertText: t.name,
                                    detail: `Table (${t.columns.length} columns)`,
                                    sortText: `0_${t.name}`,
                                    range,
                                })
                            })
                        }
                    }
                    return { suggestions: Array.from(suggestionsMap.values()) }
                }

                // Add SQL keywords
                sqlKeywords.forEach(keyword => {
                    suggestionsMap.set(keyword, {
                        label: keyword,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        detail: 'SQL Keyword',
                        sortText: `3_${keyword}`,
                        range,
                    })
                })

                // Add schema names
                schemaNames.forEach(schemaName => {
                    suggestionsMap.set(`schema_${schemaName}`, {
                        label: schemaName,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: schemaName,
                        detail: 'Schema',
                        sortText: isSchemaContext ? `0_${schemaName}` : `1_${schemaName}`,
                        range,
                    })
                })

                // Add tables from the connected database
                allTables.forEach(table => {
                    suggestionsMap.set(`table_${table.name}`, {
                        label: table.name,
                        kind: monaco.languages.CompletionItemKind.Struct,
                        insertText: table.name,
                        detail: `Table (${table.columns.length} columns)`,
                        sortText: isTableContext ? `0_${table.name}` : `1_${table.name}`,
                        range,
                    })

                    // Add schema.table format if we have a selected schema
                    if (selectedSchema) {
                        suggestionsMap.set(`table_${selectedSchema}.${table.name}`, {
                            label: `${selectedSchema}.${table.name}`,
                            kind: monaco.languages.CompletionItemKind.Struct,
                            insertText: `${selectedSchema}.${table.name}`,
                            detail: `Table in ${selectedSchema}`,
                            sortText: isTableContext ? `0_${selectedSchema}.${table.name}` : `2_${selectedSchema}.${table.name}`,
                            range,
                        })
                    }

                    // Add columns for each table (only table.column format to avoid duplicates)
                    table.columns.forEach(col => {
                        // Only add table.column format to avoid duplicate column names
                        suggestionsMap.set(`col_${table.name}.${col.name}`, {
                            label: `${table.name}.${col.name}`,
                            kind: monaco.languages.CompletionItemKind.Field,
                            insertText: `${table.name}.${col.name}`,
                            detail: col.type,
                            sortText: `2_${table.name}.${col.name}`,
                            range,
                        })
                    })
                })

                return { suggestions: Array.from(suggestionsMap.values()) }
            },
        })

            // Store the disposable for cleanup
            ; (window as any).__sqlCompletionDisposable = disposable

        // Register keyboard shortcuts - use refs to always get latest callbacks
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            onRunRef.current?.()
        })

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            onSaveRef.current?.()
        })

        // Focus editor
        editor.focus()
    }, [sqlKeywords, allTables, schemaNames, schemas, selectedSchema])

    const handleChange: OnChange = useCallback((value) => {
        onChange(value || '')
    }, [onChange])

    const handleRun = useCallback(() => {
        onRun?.()
    }, [onRun])

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowConnectionDropdown(false)
            setShowDatabaseDropdown(false)
            setShowSchemaDropdown(false)
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    return (
        <div className="sql-editor-container">
            {/* Toolbar */}
            <div className="sql-editor-toolbar">
                <div className="toolbar-left">
                    {/* Run Button */}
                    <button
                        className={`toolbar-btn run-btn ${isRunning ? 'running' : ''}`}
                        onClick={handleRun}
                        disabled={isRunning}
                        title="Run Query (Ctrl+Enter)"
                    >
                        {isRunning ? (
                            <>
                                <FaStop size={12} />
                                <span>Running...</span>
                            </>
                        ) : (
                            <>
                                <FaPlay size={12} />
                                <span>Run</span>
                            </>
                        )}
                    </button>

                    {/* Save Button */}
                    <button
                        className="toolbar-btn"
                        onClick={onSave}
                        title="Save (Ctrl+S)"
                    >
                        <FaSave size={12} />
                        <span>Save</span>
                    </button>
                </div>

                <div className="toolbar-center">
                    {/* Connection Selector */}
                    {connections.length > 0 && (
                        <div className="selector-group">
                            <div
                                className="selector-dropdown"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowConnectionDropdown(!showConnectionDropdown)
                                    setShowDatabaseDropdown(false)
                                    setShowSchemaDropdown(false)
                                }}
                            >
                                {selectedConnection ? (
                                    <>
                                        {getDatabaseIcon(selectedConnection.type, 14)}
                                        <span className="selector-value">{selectedConnection.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <FaDatabase size={14} />
                                        <span className="selector-placeholder">Select Connection</span>
                                    </>
                                )}
                                <FaChevronDown size={10} className="selector-arrow" />
                            </div>
                            {showConnectionDropdown && (
                                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    {connections.map(conn => (
                                        <div
                                            key={conn.id}
                                            className={`dropdown-item ${conn.id === selectedConnectionId ? 'selected' : ''}`}
                                            onClick={() => {
                                                onSelectConnection?.(conn.id)
                                                setShowConnectionDropdown(false)
                                            }}
                                        >
                                            {getDatabaseIcon(conn.type, 14)}
                                            <span>{conn.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Database Selector */}
                    {databases.length > 0 && (
                        <div className="selector-group">
                            <div
                                className="selector-dropdown"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowDatabaseDropdown(!showDatabaseDropdown)
                                    setShowConnectionDropdown(false)
                                    setShowSchemaDropdown(false)
                                }}
                            >
                                <FaDatabase size={12} />
                                <span className="selector-value">
                                    {databases.find(d => d.id === selectedDatabaseId)?.name || 'Select Database'}
                                </span>
                                <FaChevronDown size={10} className="selector-arrow" />
                            </div>
                            {showDatabaseDropdown && (
                                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    {databases.map(db => (
                                        <div
                                            key={db.id}
                                            className={`dropdown-item ${db.id === selectedDatabaseId ? 'selected' : ''}`}
                                            onClick={() => {
                                                onSelectDatabase?.(db.id)
                                                setShowDatabaseDropdown(false)
                                            }}
                                        >
                                            <FaDatabase size={12} />
                                            <span>{db.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Divider between connection and schema selectors */}
                    {(connections.length > 0 || databases.length > 0) && schemas.length > 0 && (
                        <div className="toolbar-divider" />
                    )}

                    {/* Schema Selector */}
                    {schemas.length > 0 && (
                        <div className="selector-group">
                            <div
                                className="selector-dropdown"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowSchemaDropdown(!showSchemaDropdown)
                                    setShowConnectionDropdown(false)
                                    setShowDatabaseDropdown(false)
                                }}
                            >
                                <TbSchema size={14} />
                                <span className="selector-value">{selectedSchema || schemas[0]?.name || 'Select Schema'}</span>
                                <FaChevronDown size={10} className="selector-arrow" />
                            </div>
                            {showSchemaDropdown && (
                                <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                    {schemas.map(schema => (
                                        <div
                                            key={schema.name}
                                            className={`dropdown-item ${schema.name === selectedSchema ? 'selected' : ''}`}
                                            onClick={() => {
                                                onSelectSchema?.(schema.name)
                                                setShowSchemaDropdown(false)
                                            }}
                                        >
                                            <TbSchema size={12} />
                                            <span>{schema.name}</span>
                                            <span className="schema-table-count">{schema.tables.length} tables</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* <div className="toolbar-right">
                    <button className="toolbar-btn ai-btn" title="Ask AI">
                        <BsStars size={14} />
                        <span>AI</span>
                    </button>
                </div> */}
            </div>

            {/* Monaco Editor */}
            <div className="sql-editor-wrapper">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    value={value}
                    onChange={handleChange}
                    onMount={handleEditorMount}
                    theme="vs-dark"
                    options={{
                        fontSize: 14,
                        fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                        lineHeight: 20,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        tabSize: 2,
                        insertSpaces: true,
                        renderWhitespace: 'selection',
                        lineNumbers: 'on',
                        glyphMargin: false,
                        folding: true,
                        lineDecorationsWidth: 10,
                        lineNumbersMinChars: 3,
                        padding: { top: 12, bottom: 12 },
                        suggest: {
                            showKeywords: true,
                            showSnippets: true,
                        },
                        quickSuggestions: {
                            other: true,
                            comments: false,
                            strings: false,
                        },
                    }}
                />
            </div>
        </div>
    )
}
