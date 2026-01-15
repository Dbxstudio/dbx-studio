import { useState, useCallback, forwardRef, useEffect } from 'react'
import {
    FaSync,
    FaPlus,
    FaChevronRight,
    FaChevronDown,
    FaTable,
    FaKey,
    FaFolder,
    FaFolderOpen,
    FaListOl,
} from 'react-icons/fa'
import { BiLogoPostgresql } from 'react-icons/bi'
import { GrMysql } from 'react-icons/gr'
import { SiSqlite, SiMariadb, SiSnowflake, SiClickhouse } from 'react-icons/si'
import { GoSidebarCollapse } from 'react-icons/go'
import { TbDatabasePlus, TbSchema } from 'react-icons/tb'
import { useQueryClient } from '@tanstack/react-query'
import { useTables, useTableColumns, useSchemas, usePrefetchTableData, tableKeys, type TableInfo, type ColumnInfo } from '../../../shared/hooks'
import './schema-tree.css'

// Cache utilities for schema tree state
const SCHEMA_TREE_CACHE_KEY = 'dbx_schema_tree_expanded'

function getCachedExpanded(connectionId: string): Record<string, boolean> {
    try {
        const cached = localStorage.getItem(`${SCHEMA_TREE_CACHE_KEY}_${connectionId}`)
        return cached ? JSON.parse(cached) : {}
    } catch {
        return {}
    }
}

function setCachedExpanded(connectionId: string, expanded: Record<string, boolean>) {
    try {
        localStorage.setItem(`${SCHEMA_TREE_CACHE_KEY}_${connectionId}`, JSON.stringify(expanded))
    } catch {
        // Ignore errors
    }
}

interface Connection {
    id: string
    name: string
    type: string
    host?: string
    port?: number
    database?: string
    isActive?: boolean
}

interface SchemaTreeProps {
    connections: Connection[]
    onTableSelect: (connectionId: string, schema: string, table: string) => void
    onClose: () => void
    onRefresh: () => void
    onAddConnection?: () => void
    onEditConnection?: (connection: Connection) => void
    onDeleteConnection?: (connectionId: string) => void
}

// Database icon mapper - returns appropriate icon based on database type
const getDatabaseIcon = (dialect: string, size = 16) => {
    if (!dialect) return <TbSchema size={size} className="db-type-icon default" />

    const dialectLower = dialect.toLowerCase()

    if (dialectLower === 'postgres' || dialectLower === 'postgresql') {
        return <BiLogoPostgresql size={size} className="db-type-icon postgres" />
    } else if (dialectLower === 'sqlite' || dialectLower === 'sqlite3') {
        return <SiSqlite size={size} className="db-type-icon sqlite" />
    } else if (dialectLower === 'mariadb') {
        return <SiMariadb size={size} className="db-type-icon mariadb" />
    } else if (dialectLower === 'mysql') {
        return <GrMysql size={size} className="db-type-icon mysql" />
    } else if (dialectLower === 'snowflake') {
        return <SiSnowflake size={size - 2} className="db-type-icon snowflake" />
    } else if (dialectLower === 'clickhouse') {
        return <SiClickhouse size={size} className="db-type-icon clickhouse" />
    }

    return <TbSchema size={size} className="db-type-icon default" />
}

export const SchemaTree = forwardRef<any, SchemaTreeProps>(({
    connections,
    onTableSelect,
    onClose,
    onRefresh,
    onAddConnection,
}, ref) => {
    // Helper to filter cached state by valid connection IDs
    const filterValidKeys = (cached: Record<string, boolean>, validIds: Set<string>): Record<string, boolean> => {
        const filtered: Record<string, boolean> = {}
        Object.keys(cached).forEach(key => {
            const connId = key.split('-')[0]
            if (validIds.has(connId) || validIds.has(key)) {
                filtered[key] = cached[key]
            }
        })
        return filtered
    }

    // Load initial expanded state from cache, filtering out stale connection IDs
    const validConnectionIds = new Set(connections.map(c => c.id))

    const [expandedConnections, setExpandedConnections] = useState<Record<string, boolean>>(() => {
        const firstConnection = connections[0]
        if (!firstConnection) return {}
        const cached = getCachedExpanded(firstConnection.id)
        return filterValidKeys(cached, validConnectionIds)
    })
    const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>(() => {
        const firstConnection = connections[0]
        if (!firstConnection) return {}
        const cached = getCachedExpanded(`${firstConnection.id}_schemas`)
        return filterValidKeys(cached, validConnectionIds)
    })
    const [expandedTableSections, setExpandedTableSections] = useState<Record<string, boolean>>(() => {
        const firstConnection = connections[0]
        if (!firstConnection) return {}
        const cached = getCachedExpanded(`${firstConnection.id}_tableSections`)
        return filterValidKeys(cached, validConnectionIds)
    })
    const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>(() => {
        const firstConnection = connections[0]
        if (!firstConnection) return {}
        const cached = getCachedExpanded(`${firstConnection.id}_tables`)
        return filterValidKeys(cached, validConnectionIds)
    })
    const [expandedColumnSections, setExpandedColumnSections] = useState<Record<string, boolean>>(() => {
        const firstConnection = connections[0]
        if (!firstConnection) return {}
        const cached = getCachedExpanded(`${firstConnection.id}_columnSections`)
        return filterValidKeys(cached, validConnectionIds)
    })
    const queryClient = useQueryClient()

    // Clean up stale expanded states when connections change
    useEffect(() => {
        if (connections.length === 0) return

        const validConnectionIds = new Set(connections.map(c => c.id))

        // Clean up expanded connections state
        setExpandedConnections(prev => {
            const cleaned: Record<string, boolean> = {}
            Object.keys(prev).forEach(id => {
                if (validConnectionIds.has(id)) {
                    cleaned[id] = prev[id]
                }
            })
            return cleaned
        })

        // Clean up expanded schemas, tables, etc. based on valid connection IDs
        setExpandedSchemas(prev => {
            const cleaned: Record<string, boolean> = {}
            Object.keys(prev).forEach(key => {
                const connId = key.split('-')[0]
                if (validConnectionIds.has(connId)) {
                    cleaned[key] = prev[key]
                }
            })
            return cleaned
        })

        setExpandedTableSections(prev => {
            const cleaned: Record<string, boolean> = {}
            Object.keys(prev).forEach(key => {
                const connId = key.split('-')[0]
                if (validConnectionIds.has(connId)) {
                    cleaned[key] = prev[key]
                }
            })
            return cleaned
        })

        setExpandedTables(prev => {
            const cleaned: Record<string, boolean> = {}
            Object.keys(prev).forEach(key => {
                const connId = key.split('-')[0]
                if (validConnectionIds.has(connId)) {
                    cleaned[key] = prev[key]
                }
            })
            return cleaned
        })

        setExpandedColumnSections(prev => {
            const cleaned: Record<string, boolean> = {}
            Object.keys(prev).forEach(key => {
                const connId = key.split('-')[0]
                if (validConnectionIds.has(connId)) {
                    cleaned[key] = prev[key]
                }
            })
            return cleaned
        })
    }, [connections])

    // Persist expanded states to cache
    useEffect(() => {
        const firstConnection = connections[0]
        if (firstConnection) {
            setCachedExpanded(firstConnection.id, expandedConnections)
        }
    }, [expandedConnections, connections])

    useEffect(() => {
        const firstConnection = connections[0]
        if (firstConnection) {
            setCachedExpanded(`${firstConnection.id}_schemas`, expandedSchemas)
        }
    }, [expandedSchemas, connections])

    useEffect(() => {
        const firstConnection = connections[0]
        if (firstConnection) {
            setCachedExpanded(`${firstConnection.id}_tableSections`, expandedTableSections)
        }
    }, [expandedTableSections, connections])

    useEffect(() => {
        const firstConnection = connections[0]
        if (firstConnection) {
            setCachedExpanded(`${firstConnection.id}_tables`, expandedTables)
        }
    }, [expandedTables, connections])

    useEffect(() => {
        const firstConnection = connections[0]
        if (firstConnection) {
            setCachedExpanded(`${firstConnection.id}_columnSections`, expandedColumnSections)
        }
    }, [expandedColumnSections, connections])

    const toggleConnection = useCallback((connectionId: string) => {
        setExpandedConnections(prev => ({
            ...prev,
            [connectionId]: !prev[connectionId]
        }))
    }, [])

    const toggleSchema = useCallback((key: string) => {
        setExpandedSchemas(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }, [])

    const toggleTableSection = useCallback((key: string) => {
        setExpandedTableSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }, [])

    const toggleTable = useCallback((key: string) => {
        setExpandedTables(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }, [])

    const toggleColumnSection = useCallback((key: string) => {
        setExpandedColumnSections(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }, [])

    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: tableKeys.all })
        onRefresh()
    }, [queryClient, onRefresh])

    return (
        <div className="schema-tree-container">
            {/* Header */}
            <div className="schema-header">
                <div className="schema-title">
                    <span className="schema-label">Connections</span>
                </div>
                <div className="schema-controls">
                    <button
                        className="schema-btn add-connection-btn"
                        onClick={onAddConnection}
                        title="New Connection"
                    >
                        <TbDatabasePlus size={16} />
                    </button>
                    <button
                        className="schema-btn"
                        onClick={handleRefresh}
                        title="Refresh"
                    >
                        <FaSync size={12} />
                    </button>
                    <button
                        className="schema-btn collapse-schema-btn"
                        onClick={onClose}
                        title="Collapse Schema Tree"
                    >
                        <GoSidebarCollapse size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="schema-content-wrapper">
                {connections.length === 0 ? (
                    <div className="schema-empty">
                        <p>No connections yet</p>
                        <button className="add-connection-cta" onClick={onAddConnection}>
                            <FaPlus size={12} />
                            <span>Add Connection</span>
                        </button>
                    </div>
                ) : (
                    connections.map(conn => (
                        <ConnectionBlock
                            key={conn.id}
                            connection={conn}
                            isExpanded={!!expandedConnections[conn.id]}
                            expandedSchemas={expandedSchemas}
                            expandedTableSections={expandedTableSections}
                            expandedTables={expandedTables}
                            expandedColumnSections={expandedColumnSections}
                            onToggle={() => toggleConnection(conn.id)}
                            onToggleSchema={toggleSchema}
                            onToggleTableSection={toggleTableSection}
                            onToggleTable={toggleTable}
                            onToggleColumnSection={toggleColumnSection}
                            onTableSelect={onTableSelect}
                        />
                    ))
                )}
            </div>
        </div>
    )
})

SchemaTree.displayName = 'SchemaTree'

// Connection Block Component
interface ConnectionBlockProps {
    connection: Connection
    isExpanded: boolean
    expandedSchemas: Record<string, boolean>
    expandedTableSections: Record<string, boolean>
    expandedTables: Record<string, boolean>
    expandedColumnSections: Record<string, boolean>
    onToggle: () => void
    onToggleSchema: (key: string) => void
    onToggleTableSection: (key: string) => void
    onToggleTable: (key: string) => void
    onToggleColumnSection: (key: string) => void
    onTableSelect: (connectionId: string, schema: string, table: string) => void
}

function ConnectionBlock({
    connection,
    isExpanded,
    expandedSchemas,
    expandedTableSections,
    expandedTables,
    expandedColumnSections,
    onToggle,
    onToggleSchema,
    onToggleTableSection,
    onToggleTable,
    onToggleColumnSection,
    onTableSelect,
}: ConnectionBlockProps) {
    // Fetch schemas when connection is expanded
    const { data: schemas, isLoading: loadingSchemas } = useSchemas(isExpanded ? connection.id : undefined)

    return (
        <div className="connection-block">
            {/* Connection Header */}
            <div className={`connection-header ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
                <span className="connection-toggle">
                    {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                </span>
                {getDatabaseIcon(connection.type, 16)}
                <span className="connection-name">{connection.name}</span>
                {connection.isActive && (
                    <span className="connection-status">✓</span>
                )}
            </div>

            {/* Connection Children - Schemas */}
            {isExpanded && (
                <div className="connection-schema-wrapper">
                    {loadingSchemas ? (
                        <div className="schema-status loading">
                            <FaSync size={10} className="spinning" />
                            <span>Loading schemas...</span>
                        </div>
                    ) : schemas && schemas.length > 0 ? (
                        schemas.map(schema => {
                            const schemaKey = `${connection.id}-${schema.name}`
                            const isSchemaExpanded = !!expandedSchemas[schemaKey]
                            return (
                                <SchemaBlock
                                    key={schemaKey}
                                    connectionId={connection.id}
                                    schemaName={schema.name}
                                    isExpanded={isSchemaExpanded}
                                    expandedTableSections={expandedTableSections}
                                    expandedTables={expandedTables}
                                    expandedColumnSections={expandedColumnSections}
                                    onToggle={() => onToggleSchema(schemaKey)}
                                    onToggleTableSection={onToggleTableSection}
                                    onToggleTable={onToggleTable}
                                    onToggleColumnSection={onToggleColumnSection}
                                    onTableSelect={onTableSelect}
                                />
                            )
                        })
                    ) : (
                        // Fallback to public if no schemas returned
                        <SchemaBlock
                            connectionId={connection.id}
                            schemaName="public"
                            isExpanded={!!expandedSchemas[`${connection.id}-public`]}
                            expandedTableSections={expandedTableSections}
                            expandedTables={expandedTables}
                            expandedColumnSections={expandedColumnSections}
                            onToggle={() => onToggleSchema(`${connection.id}-public`)}
                            onToggleTableSection={onToggleTableSection}
                            onToggleTable={onToggleTable}
                            onToggleColumnSection={onToggleColumnSection}
                            onTableSelect={onTableSelect}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

// Schema Block Component
interface SchemaBlockProps {
    connectionId: string
    schemaName: string
    isExpanded: boolean
    expandedTableSections: Record<string, boolean>
    expandedTables: Record<string, boolean>
    expandedColumnSections: Record<string, boolean>
    onToggle: () => void
    onToggleTableSection: (key: string) => void
    onToggleTable: (key: string) => void
    onToggleColumnSection: (key: string) => void
    onTableSelect: (connectionId: string, schema: string, table: string) => void
}

function SchemaBlock({
    connectionId,
    schemaName,
    isExpanded,
    expandedTableSections,
    expandedTables,
    expandedColumnSections,
    onToggle,
    onToggleTableSection,
    onToggleTable,
    onToggleColumnSection,
    onTableSelect,
}: SchemaBlockProps) {
    const { data: tables, isLoading } = useTables(
        isExpanded ? connectionId : '',
        schemaName
    )

    const tableCount = tables?.length || 0
    const tableSectionKey = `${connectionId}-${schemaName}-tables`
    const isTableSectionExpanded = !!expandedTableSections[tableSectionKey]

    return (
        <div className="schema-item">
            {/* Schema Header */}
            <div className="schema-header-row" onClick={onToggle}>
                <span className="schema-toggle">
                    {isLoading ? (
                        <FaSync size={10} className="spinning" />
                    ) : isExpanded ? (
                        <FaChevronDown size={10} />
                    ) : (
                        <FaChevronRight size={10} />
                    )}
                </span>
                <TbSchema size={14} className="schema-icon" />
                <span className="schema-name">{schemaName}</span>
                {tableCount > 0 && (
                    <span className="schema-count">{tableCount}</span>
                )}
            </div>

            {/* Schema Content - Tables Folder */}
            {isExpanded && (
                <div className="db-object-group">
                    {/* Tables Folder */}
                    <div
                        className="db-object-group-header"
                        onClick={() => onToggleTableSection(tableSectionKey)}
                    >
                        <span className="schema-toggle">
                            {isTableSectionExpanded ? (
                                <FaChevronDown size={9} />
                            ) : (
                                <FaChevronRight size={9} />
                            )}
                        </span>
                        {isTableSectionExpanded ? (
                            <FaFolderOpen size={10} className="db-object-icon folder-icon" />
                        ) : (
                            <FaFolder size={10} className="db-object-icon folder-icon" />
                        )}
                        <span className="db-object-label">Tables</span>
                        {tableCount > 0 && (
                            <span className="db-object-count">{tableCount}</span>
                        )}
                    </div>

                    {/* Tables List */}
                    {isTableSectionExpanded && (
                        <div className="tables-list">
                            {isLoading ? (
                                <div className="schema-status loading">
                                    <FaSync size={10} className="spinning" />
                                    <span>Loading tables...</span>
                                </div>
                            ) : tables && tables.length > 0 ? (
                                tables.map(table => (
                                    <TableItem
                                        key={table.name}
                                        connectionId={connectionId}
                                        schemaName={schemaName}
                                        table={table}
                                        isExpanded={!!expandedTables[`${connectionId}-${schemaName}-${table.name}`]}
                                        expandedColumnSections={expandedColumnSections}
                                        onToggle={() => onToggleTable(`${connectionId}-${schemaName}-${table.name}`)}
                                        onToggleColumnSection={onToggleColumnSection}
                                        onSelect={() => onTableSelect(connectionId, schemaName, table.name)}
                                    />
                                ))
                            ) : (
                                <div className="schema-empty">No tables found</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Table Item Component
interface TableItemProps {
    connectionId: string
    schemaName: string
    table: TableInfo
    isExpanded: boolean
    expandedColumnSections: Record<string, boolean>
    onToggle: () => void
    onToggleColumnSection: (key: string) => void
    onSelect: () => void
}

function TableItem({
    connectionId,
    schemaName,
    table,
    isExpanded,
    expandedColumnSections,
    onToggle,
    onToggleColumnSection,
    onSelect,
}: TableItemProps) {
    const { data: columns, isLoading } = useTableColumns(
        isExpanded ? connectionId : '',
        table.name,
        schemaName
    )

    const prefetchTableData = usePrefetchTableData()

    const columnSectionKey = `${connectionId}-${schemaName}-${table.name}-columns`
    const isColumnSectionExpanded = !!expandedColumnSections[columnSectionKey]
    const columnCount = columns?.length || 0

    const handleMouseEnter = useCallback(() => {
        // Prefetch columns and first 50 rows on hover
        if (!isExpanded && connectionId && table.name) {
            prefetchTableData(connectionId, table.name, schemaName)
        }
    }, [isExpanded, connectionId, table.name, schemaName, prefetchTableData])

    return (
        <div className="table-item">
            {/* Table Header */}
            <div
                className={`table-header ${isExpanded ? 'expanded' : ''}`}
                onClick={onSelect}
                onMouseEnter={handleMouseEnter}
            >
                <span
                    className="table-toggle"
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggle()
                    }}
                >
                    {isLoading ? (
                        <FaSync size={8} className="spinning" />
                    ) : isExpanded ? (
                        <FaChevronDown size={9} />
                    ) : (
                        <FaChevronRight size={9} />
                    )}
                </span>
                <FaTable size={10} className="table-icon" />
                <span className="table-name">{table.name}</span>
            </div>

            {/* Table Details */}
            {isExpanded && (
                <div className="table-details">
                    {/* Columns Section */}
                    <div className="table-detail-section">
                        <div
                            className="table-detail-header"
                            onClick={() => onToggleColumnSection(columnSectionKey)}
                        >
                            <span className="detail-toggle">
                                {isColumnSectionExpanded ? (
                                    <FaChevronDown size={7} />
                                ) : (
                                    <FaChevronRight size={7} />
                                )}
                            </span>
                            {isColumnSectionExpanded ? (
                                <FaFolderOpen size={8} className="detail-icon folder-icon" />
                            ) : (
                                <FaFolder size={8} className="detail-icon folder-icon" />
                            )}
                            <span className="detail-label">Columns</span>
                            {columnCount > 0 && (
                                <span className="detail-count">{columnCount}</span>
                            )}
                        </div>

                        {/* Column List */}
                        {isColumnSectionExpanded && (
                            <div className="table-detail-list">
                                {isLoading ? (
                                    <div className="schema-status loading">
                                        <FaSync size={9} className="spinning" />
                                        <span>Loading columns...</span>
                                    </div>
                                ) : columns && columns.length > 0 ? (
                                    columns.map((col, idx) => (
                                        <div key={idx} className="detail-item">
                                            {col.isPrimaryKey ? (
                                                <FaKey size={7} className="detail-item-icon key-icon" />
                                            ) : (
                                                <FaListOl size={7} className="detail-item-icon" />
                                            )}
                                            <span className="detail-item-name">{col.name}</span>
                                            <span className="detail-item-type">{col.type}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="schema-empty">No columns found</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
