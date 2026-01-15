import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sidebar } from '~/features/layout'
import { SchemaTree } from '~/features/schema'
import { ConnectionModal } from '~/features/connections'
import { SQLEditor } from '~/features/editor'
import { ResultsPanel } from '~/features/results'
import { DataGrid } from '~/features/datagrid'
import { AIChat } from '~/features/ai'
import { SettingsPage } from '~/features/settings'
import { useAuth } from '~/features/auth'
import { useConnections, useTables, useTableColumns, useInfiniteTableData, useExecuteQuery, useSchemas, useUpdateRow, useDeleteRow } from '~/shared/hooks'
import {
    getCachedOpenTabs,
    setCachedOpenTabs,
    getCachedActiveTab,
    setCachedActiveTab,
    getCachedQueryEditorContent,
    setCachedQueryEditorContent,
    removeCachedQueryEditorContent,
} from '~/shared/utils/cache'

type ViewType = 'collections' | 'dashboard' | 'settings-page'

interface TableContext {
    schema: string
    tableName: string
    title: string
    filterColumn?: string
    filterValue?: unknown
}

interface TabInfo {
    id: string
    type: 'worksheet' | 'table'
    title: string
    connectionId?: string
    databaseId?: string
    schema?: string
    tableName?: string
    sql?: string
    filterColumn?: string
    filterValue?: unknown
    // Navigation history for FK drill-down
    history?: TableContext[]
}

export default function Workspace() {
    // Auth context
    const { user, logout } = useAuth()

    // Query client for cache management
    const queryClient = useQueryClient()

    // State
    const [currentView, setCurrentView] = useState<ViewType>('collections')
    const [showSchemaTree, setShowSchemaTree] = useState(true)
    const [showAIChat, setShowAIChat] = useState(false)
    const [showConnectionModal, setShowConnectionModal] = useState(false)

    // Initialize tabs and active tab from cache
    const [tabs, setTabs] = useState<TabInfo[]>(() => {
        const cachedTabs = getCachedOpenTabs()
        if (cachedTabs && cachedTabs.length > 0) {
            return cachedTabs
        }
        return [
            { id: 'worksheet-1', type: 'worksheet', title: 'Worksheet 1', sql: '-- Write your SQL query here\nSELECT * FROM ' }
        ]
    })
    const [activeTabId, setActiveTabId] = useState(() => {
        const cachedActiveTab = getCachedActiveTab()
        if (cachedActiveTab && tabs.some(t => t.id === cachedActiveTab)) {
            return cachedActiveTab
        }
        return 'worksheet-1'
    })

    // Query state
    const [isQueryRunning, setIsQueryRunning] = useState(false)
    const [queryResults, setQueryResults] = useState<any[][]>([])
    const [queryColumns, setQueryColumns] = useState<{ name: string; type?: string }[]>([])
    const [queryError, setQueryError] = useState<string | null>(null)
    const [executionTime, setExecutionTime] = useState<number | undefined>(undefined)

    // API data - filter connections by user_id
    const { data: connectionsData } = useConnections(user?.user_id)
    const connections = connectionsData?.connections || []

    // Clear tabs when user changes (to remove previous user's database tabs)
    useEffect(() => {
        if (user?.user_id) {
            // Reset to default worksheet when user changes
            const defaultTab = {
                id: 'worksheet-1',
                type: 'worksheet' as const,
                title: 'Worksheet 1',
                sql: '-- Write your SQL query here\nSELECT * FROM '
            }
            setTabs([defaultTab])
            setActiveTabId('worksheet-1')

            // Clear cached tabs
            setCachedOpenTabs([defaultTab])
            setCachedActiveTab('worksheet-1')

            // Clear schema tree cache to remove old connection states
            const schemaTreeKeys = [
                'dbx_schema_tree_expanded',
                'dbx_schema_tree_expanded_schemas',
                'dbx_schema_tree_expanded_tableSections',
                'dbx_schema_tree_expanded_tables',
                'dbx_schema_tree_expanded_columnSections'
            ]
            schemaTreeKeys.forEach(key => {
                // Find all localStorage keys that start with this pattern
                Object.keys(localStorage).forEach(storageKey => {
                    if (storageKey.startsWith(key)) {
                        localStorage.removeItem(storageKey)
                    }
                })
            })
        }
    }, [user?.user_id])

    // Get active tab
    const activeTab = tabs.find(t => t.id === activeTabId)

    // Selected connection for the active worksheet
    const selectedConnectionId = activeTab?.connectionId || connections[0]?.id
    const selectedConnection = connections.find(c => c.id === selectedConnectionId)

    // Fetch schemas for the selected connection
    const { data: schemas } = useSchemas(selectedConnectionId)

    // Fetch tables for autocomplete
    const { data: tables } = useTables(selectedConnectionId || '', activeTab?.schema || 'public')

    // Prepare tables with columns for autocomplete
    const tablesWithColumns = useMemo(() => {
        if (!tables) return []
        return tables.map(t => ({
            name: t.name,
            columns: [] // Will be populated when expanded
        }))
    }, [tables])

    // Fetch table data if viewing a table tab
    const { data: tableColumnsData } = useTableColumns(
        activeTab?.type === 'table' ? activeTab.connectionId || '' : '',
        activeTab?.tableName || '',
        activeTab?.schema || 'public'
    )

    // Build server-side filters for FK navigation
    const serverFilters = useMemo(() => {
        if (activeTab?.type === 'table' && activeTab.filterColumn && activeTab.filterValue !== undefined) {
            return [{
                column: activeTab.filterColumn,
                operator: '=' as const,
                values: [activeTab.filterValue],
            }]
        }
        return undefined
    }, [activeTab?.type, activeTab?.filterColumn, activeTab?.filterValue])

    const {
        data: tableDataPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingTableData,
        refetch: refetchTableData,
    } = useInfiniteTableData(
        activeTab?.type === 'table' ? activeTab.connectionId || '' : '',
        activeTab?.tableName || '',
        activeTab?.schema || 'public',
        { pageSize: 50, filters: serverFilters }
    )

    // Flatten all pages into a single array of rows
    const tableDataRows = tableDataPages?.pages?.flatMap(page => page.rows) || []
    const tableTotalCount = tableDataPages?.pages?.[0]?.total || 0

    // Convert connections for the editor
    const editorConnections = useMemo(() =>
        connections.map(c => ({
            id: c.id,
            name: c.name || c.host || 'Connection',
            type: c.type
        })),
        [connections]
    )

    // Persist tabs to cache whenever they change
    useEffect(() => {
        setCachedOpenTabs(tabs)
    }, [tabs])

    // Persist active tab to cache whenever it changes
    useEffect(() => {
        setCachedActiveTab(activeTabId)
    }, [activeTabId])

    // Load cached query content when active tab changes
    useEffect(() => {
        if (activeTab?.type === 'worksheet' && activeTab.id) {
            const cachedContent = getCachedQueryEditorContent(activeTab.id)
            if (cachedContent && cachedContent !== activeTab.sql) {
                setTabs(prev => prev.map(tab =>
                    tab.id === activeTab.id ? { ...tab, sql: cachedContent } : tab
                ))
            }
        }
    }, [activeTab?.id])

    // Handlers
    const handleSidebarClick = useCallback((view: ViewType) => {
        setCurrentView(view)
    }, [])

    const handleRefreshConnections = useCallback(() => {
        // Invalidate all connection queries to force a refetch
        queryClient.invalidateQueries({ queryKey: ['connections'] })
    }, [queryClient])

    const handleTableSelect = useCallback((connectionId: string, schema: string, tableName: string) => {
        const tabId = `table-${connectionId}-${schema}-${tableName}`

        // Check if tab already exists
        const existingTab = tabs.find(t => t.id === tabId)
        if (existingTab) {
            setActiveTabId(tabId)
            return
        }

        // Create new tab
        const newTab: TabInfo = {
            id: tabId,
            type: 'table',
            title: tableName,
            connectionId,
            schema,
            tableName,
        }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(tabId)
    }, [tabs])

    // Navigate to a foreign key table in the same tab (with history for back navigation)
    const handleForeignKeyNavigate = useCallback((foreignTable: string, foreignSchema: string, filterColumn: string, filterValue: unknown) => {
        if (!activeTab || activeTab.type !== 'table') return

        // Save current table context to history
        const currentContext: TableContext = {
            schema: activeTab.schema || 'public',
            tableName: activeTab.tableName || '',
            title: activeTab.title,
            filterColumn: activeTab.filterColumn,
            filterValue: activeTab.filterValue,
        }

        // Update the current tab to show the FK table
        setTabs(prev => prev.map(tab =>
            tab.id === activeTab.id
                ? {
                    ...tab,
                    schema: foreignSchema,
                    tableName: foreignTable,
                    title: `${foreignTable} (${filterColumn}=${String(filterValue)})`,
                    filterColumn,
                    filterValue,
                    history: [...(tab.history || []), currentContext],
                }
                : tab
        ))
    }, [activeTab])

    // Navigate back to the previous table in history
    const handleNavigateBack = useCallback(() => {
        if (!activeTab || activeTab.type !== 'table' || !activeTab.history?.length) return

        const history = [...activeTab.history]
        const previousContext = history.pop()

        if (previousContext) {
            setTabs(prev => prev.map(tab =>
                tab.id === activeTab.id
                    ? {
                        ...tab,
                        schema: previousContext.schema,
                        tableName: previousContext.tableName,
                        title: previousContext.title,
                        filterColumn: previousContext.filterColumn,
                        filterValue: previousContext.filterValue,
                        history,
                    }
                    : tab
            ))
        }
    }, [activeTab])

    const handleCloseTab = useCallback((tabId: string) => {
        // Remove cached query content for this tab
        removeCachedQueryEditorContent(tabId)

        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== tabId)
            if (activeTabId === tabId && newTabs.length > 0) {
                setActiveTabId(newTabs[newTabs.length - 1].id)
            }
            return newTabs
        })
    }, [activeTabId])

    const handleAddWorksheet = useCallback(() => {
        const newId = `worksheet-${Date.now()}`
        const worksheetCount = tabs.filter(t => t.type === 'worksheet').length + 1
        const newTab: TabInfo = {
            id: newId,
            type: 'worksheet',
            title: `Worksheet ${worksheetCount}`,
            connectionId: connections[0]?.id,
            sql: '-- Write your SQL query here\nSELECT * FROM ',
        }
        setTabs(prev => [...prev, newTab])
        setActiveTabId(newId)
    }, [tabs, connections])

    const handleSqlChange = useCallback((sql: string) => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, sql } : t
        ))
        // Cache the query content
        if (activeTabId) {
            setCachedQueryEditorContent(activeTabId, sql)
        }
    }, [activeTabId])

    const handleSelectConnection = useCallback((connectionId: string) => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, connectionId } : t
        ))
    }, [activeTabId])

    const handleSelectDatabase = useCallback((databaseId: string) => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, databaseId } : t
        ))
    }, [activeTabId])

    const handleSelectSchema = useCallback((schema: string) => {
        setTabs(prev => prev.map(t =>
            t.id === activeTabId ? { ...t, schema } : t
        ))
    }, [activeTabId])

    // Real query execution using the API
    const { mutateAsync: executeQuery } = useExecuteQuery()

    // Table mutation hooks
    const { mutateAsync: updateRowMutation } = useUpdateRow()
    const { mutateAsync: deleteRowMutation } = useDeleteRow()

    // Handle cell edit for table data
    const handleCellEdit = useCallback(async (rowIndex: number, columnId: string, value: unknown) => {
        if (!activeTab || activeTab.type !== 'table') return

        const row = tableDataRows[rowIndex]
        if (!row) {
            toast.error('Row not found')
            return
        }

        // Get primary key columns
        const primaryKeyCols = tableColumnsData?.filter(c => c.isPrimaryKey) || []
        if (primaryKeyCols.length === 0) {
            toast.error('Cannot update: No primary key found')
            return
        }

        // Build primary key object
        const primaryKey: Record<string, unknown> = {}
        primaryKeyCols.forEach(col => {
            primaryKey[col.name] = row[col.name]
        })

        // Get column metadata to determine proper type
        const columnMeta = tableColumnsData?.find(c => c.name === columnId)
        let typedValue: unknown = value

        // Convert value to proper type based on column type
        if (columnMeta?.type) {
            const type = columnMeta.type.toLowerCase()

            // Handle NULL values
            if (value === null || value === undefined || value === '' && columnMeta.nullable) {
                typedValue = null
            }
            // Numeric types
            else if (type.includes('int') || type.includes('serial') || type.includes('bigint') || type.includes('smallint')) {
                typedValue = value === '' ? null : parseInt(String(value), 10)
            }
            else if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double') || type.includes('real')) {
                typedValue = value === '' ? null : parseFloat(String(value))
            }
            // Boolean types
            else if (type.includes('bool')) {
                if (typeof value === 'boolean') {
                    typedValue = value
                } else {
                    const strVal = String(value).toLowerCase()
                    typedValue = strVal === 'true' || strVal === '1' || strVal === 't' || strVal === 'yes'
                }
            }
            // Date/time types
            else if (type.includes('date') || type.includes('time')) {
                typedValue = value === '' ? null : String(value)
            }
            // JSON types
            else if (type.includes('json')) {
                if (typeof value === 'string') {
                    try {
                        typedValue = JSON.parse(value)
                    } catch {
                        typedValue = value
                    }
                } else {
                    typedValue = value
                }
            }
            // String types (text, varchar, char, etc.)
            else {
                typedValue = String(value)
            }
        }

        try {
            await updateRowMutation({
                connectionId: activeTab.connectionId || '',
                tableName: activeTab.tableName || '',
                schema: activeTab.schema || 'public',
                primaryKey,
                data: { [columnId]: typedValue },
            })

            // Refetch table data
            await refetchTableData()
            toast.success('Row updated successfully')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update row'
            toast.error(errorMessage)
            console.error('Update row error:', error)
        }
    }, [activeTab, tableDataRows, tableColumnsData, updateRowMutation, refetchTableData])

    // Handle row delete for table data
    const handleRowDelete = useCallback(async (rows: Record<string, unknown>[]) => {
        if (!activeTab || activeTab.type !== 'table') return

        // Get primary key columns
        const primaryKeyCols = tableColumnsData?.filter(c => c.isPrimaryKey) || []
        if (primaryKeyCols.length === 0) {
            toast.error('Cannot delete: No primary key found')
            return
        }

        try {
            // Delete each row
            for (const row of rows) {
                const primaryKey: Record<string, unknown> = {}
                primaryKeyCols.forEach(col => {
                    primaryKey[col.name] = row[col.name]
                })

                await deleteRowMutation({
                    connectionId: activeTab.connectionId || '',
                    tableName: activeTab.tableName || '',
                    schema: activeTab.schema || 'public',
                    primaryKey,
                })
            }

            // Refetch table data
            await refetchTableData()
            toast.success(`${rows.length} row(s) deleted successfully`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete rows'
            toast.error(errorMessage)
            console.error('Delete rows error:', error)
        }
    }, [activeTab, tableColumnsData, deleteRowMutation, refetchTableData])

    const handleRunQuery = useCallback(async () => {
        if (!selectedConnectionId) {
            toast.error('Please select a connection first')
            return
        }

        if (!activeTab?.sql || !activeTab.sql.trim()) {
            toast.error('Please enter a SQL query')
            return
        }

        setIsQueryRunning(true)
        setQueryError(null)

        try {
            const result = await executeQuery({
                connectionId: selectedConnectionId,
                sql: activeTab.sql,
                saveToHistory: true,
            })

            // Convert result rows to array format
            const rows = result.rows as Record<string, unknown>[]
            if (rows.length > 0) {
                // Extract column names from first row
                const columns = Object.keys(rows[0]).map(key => ({
                    name: key,
                    type: typeof rows[0][key],
                }))
                setQueryColumns(columns)

                // Convert rows to array of arrays format
                const rowsArray = rows.map(row => Object.values(row))
                setQueryResults(rowsArray)
            } else {
                setQueryColumns([])
                setQueryResults([])
            }

            setExecutionTime(result.duration)
            toast.success(`Query executed successfully (${result.rowCount} rows in ${result.duration}ms)`)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Query execution failed'
            setQueryError(errorMessage)
            setQueryResults([])
            setQueryColumns([])
        } finally {
            setIsQueryRunning(false)
        }
    }, [selectedConnectionId, activeTab?.sql, executeQuery])

    return (
        <div className="query-main-container">
            <div className="query-main-body">
                {/* Sidebar */}
                <Sidebar
                    currentView={currentView}
                    setView={handleSidebarClick}
                    isAIChatOpen={showAIChat}
                    onToggleAIChat={() => setShowAIChat(prev => !prev)}
                    isSchemaTreeVisible={showSchemaTree}
                    onToggleSchemaTree={() => setShowSchemaTree(prev => !prev)}
                    userInfo={user}
                    onLogout={logout}
                />

                {/* Main Content */}
                <div className="query-main-content">
                    {currentView === 'settings-page' ? (
                        <SettingsPage />
                    ) : currentView === 'dashboard' ? (
                        <div className="dashboard-view">
                            <h1>Dashboard</h1>
                            <p>Coming soon...</p>
                        </div>
                    ) : (
                        <div className="query-workspace">
                            {/* Left Panel - Schema Tree */}
                            {showSchemaTree && (
                                <div className="query-left">
                                    <SchemaTree
                                        connections={connections.map(c => ({
                                            id: c.id,
                                            name: c.name || c.host || 'Connection',
                                            type: c.type,
                                            isActive: c.isActive,
                                        }))}
                                        onTableSelect={handleTableSelect}
                                        onClose={() => setShowSchemaTree(false)}
                                        onRefresh={handleRefreshConnections}
                                        onAddConnection={() => setShowConnectionModal(true)}
                                    />
                                </div>
                            )}

                            {/* Center Panel - Editor & Results */}
                            <div className="query-center">
                                {/* Tabs */}
                                <div className="workspace-tabs">
                                    {tabs.map(tab => (
                                        <div
                                            key={tab.id}
                                            className={`workspace-tab ${activeTabId === tab.id ? 'active' : ''}`}
                                            onClick={() => setActiveTabId(tab.id)}
                                        >
                                            <span className="tab-title">{tab.title}</span>
                                            <button
                                                className="tab-close"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleCloseTab(tab.id)
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button className="add-tab-btn" onClick={handleAddWorksheet}>
                                        +
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="workspace-content">
                                    {activeTab?.type === 'worksheet' ? (
                                        <>
                                            {/* SQL Editor */}
                                            <div className="editor-section">
                                                <SQLEditor
                                                    value={activeTab.sql || ''}
                                                    onChange={handleSqlChange}
                                                    onRun={handleRunQuery}
                                                    isRunning={isQueryRunning}
                                                    connections={editorConnections}
                                                    selectedConnectionId={activeTab.connectionId}
                                                    onSelectConnection={handleSelectConnection}
                                                    schemas={schemas || []}
                                                    selectedSchema={activeTab.schema}
                                                    onSelectSchema={handleSelectSchema}
                                                    tables={tablesWithColumns}
                                                />
                                            </div>

                                            {/* Results */}
                                            <div className="results-section">
                                                <ResultsPanel
                                                    columns={queryColumns}
                                                    rows={queryResults}
                                                    loading={isQueryRunning}
                                                    error={queryError}
                                                    executionTime={executionTime}
                                                />
                                            </div>
                                        </>
                                    ) : activeTab?.type === 'table' ? (
                                        <div className="table-data-section">
                                            <DataGrid
                                                columns={tableColumnsData?.map(c => ({
                                                    id: c.name,
                                                    name: c.name,
                                                    type: c.type,
                                                    isPrimaryKey: c.isPrimaryKey,
                                                    isNullable: c.nullable,
                                                    isForeignKey: c.isForeignKey,
                                                    foreignSchema: c.foreignSchema,
                                                    foreignTable: c.foreignTable,
                                                    foreignColumn: c.foreignColumn,
                                                })) || []}
                                                data={tableDataRows}
                                                tableName={activeTab.tableName}
                                                schema={activeTab.schema}
                                                loading={!tableColumnsData || isLoadingTableData}
                                                readOnly={false}
                                                hasMore={hasNextPage}
                                                isFetchingMore={isFetchingNextPage}
                                                totalCount={tableTotalCount}
                                                onLoadMore={() => {
                                                    if (!isFetchingNextPage && hasNextPage) {
                                                        fetchNextPage()
                                                    }
                                                }}
                                                onRefresh={() => {
                                                    refetchTableData()
                                                }}
                                                onCellEdit={handleCellEdit}
                                                onRowDelete={handleRowDelete}
                                                onForeignKeyNavigate={handleForeignKeyNavigate}
                                                canNavigateBack={!!activeTab.history?.length}
                                                onNavigateBack={handleNavigateBack}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Right Panel - AI Chat */}
                            {showAIChat && (
                                <div className="query-right">
                                    <AIChat
                                        isOpen={showAIChat}
                                        onClose={() => setShowAIChat(false)}
                                        connectionId={selectedConnectionId}
                                        externalConnectionId={selectedConnection?.externalConnectionId}
                                        schema={activeTab?.schema}
                                        tables={tables?.map(t => t.name)}
                                        tableDetails={activeTab?.type === 'table' && activeTab.tableName ? {
                                            tableName: activeTab.tableName,
                                            schema: activeTab.schema,
                                            columns: tableColumnsData?.map(c => ({
                                                name: c.name,
                                                type: c.type,
                                                nullable: c.nullable,
                                                isPrimaryKey: c.isPrimaryKey,
                                            })),
                                            sampleRows: tableDataRows.slice(0, 3),
                                        } : undefined}
                                        onRunQuery={(sql) => {
                                            handleSqlChange(sql)
                                            handleRunQuery()
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Connection Modal */}
            <ConnectionModal
                isOpen={showConnectionModal}
                onClose={() => setShowConnectionModal(false)}
                userId={user?.user_id}
            />
        </div>
    )
}
