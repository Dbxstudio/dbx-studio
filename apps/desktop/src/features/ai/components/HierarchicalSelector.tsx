import { useState, useRef, useEffect } from 'react'
import { Database, Table, ChevronDown, Loader2 } from 'lucide-react'

interface Schema {
    schema_id: string | number
    schema_name: string
}

interface TableItem {
    schema_table_id?: string | number
    table_id?: string | number
    table_name: string
}

interface HierarchicalSelectorProps {
    schemas?: Schema[]
    tables?: TableItem[]
    selectedSchemaId?: string | number
    selectedTableId?: string | number
    onSchemaChange: (schemaId: string | number) => void
    onTableChange: (tableId: string | number) => void
    loadingSchemas?: boolean
    loadingTables?: boolean
    disabled?: boolean
    className?: string
    // When true, hide schema selector and show only tables dropdown
    tablesOnly?: boolean
    // When true, show the tables dropdown even if no schema is selected
    forceShowTables?: boolean
}

export function HierarchicalSelector({
    schemas = [],
    tables = [],
    selectedSchemaId,
    selectedTableId,
    onSchemaChange,
    onTableChange,
    loadingSchemas = false,
    loadingTables = false,
    disabled = false,
    className = '',
    tablesOnly = false,
    forceShowTables = false
}: HierarchicalSelectorProps) {
    const [schemaDropdownOpen, setSchemaDropdownOpen] = useState(false)
    const [tableDropdownOpen, setTableDropdownOpen] = useState(false)
    const schemaDropdownRef = useRef<HTMLDivElement>(null)
    const tableDropdownRef = useRef<HTMLDivElement>(null)

    // Normalize schemas array
    const normSchemas = Array.isArray(schemas) ? schemas : []

    // Normalize tables array and strip schema prefix from names
    const normTables = (Array.isArray(tables) ? tables : []).map(t => {
        const id = t.schema_table_id != null ? t.schema_table_id : t.table_id
        // Strip schema prefix if present (e.g., "public.orders" -> "orders")
        const name = (t.table_name || '').includes('.')
            ? (t.table_name || '').split('.').pop() || t.table_name
            : t.table_name
        return { ...t, schema_table_id: id, table_name: name }
    })

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (schemaDropdownRef.current && !schemaDropdownRef.current.contains(event.target as Node)) {
                setSchemaDropdownOpen(false)
            }
            if (tableDropdownRef.current && !tableDropdownRef.current.contains(event.target as Node)) {
                setTableDropdownOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Get display text for schema button
    const getSchemaDisplayText = () => {
        if (!selectedSchemaId) {
            return 'All Schemas'
        }
        const schema = normSchemas.find(s => String(s.schema_id) === String(selectedSchemaId))
        return schema?.schema_name || `Schema ${selectedSchemaId}`
    }

    // Get display text for table button
    const getTableDisplayText = () => {
        if (!selectedTableId) {
            return 'All Tables'
        }
        const table = normTables.find(t => String(t.schema_table_id) === String(selectedTableId))
        return table?.table_name || `Table ${selectedTableId}`
    }

    // Handle schema selection
    const handleSchemaSelect = (schema: Schema | { schema_id: string, schema_name: string }) => {
        if (selectedSchemaId === schema.schema_id) {
            // Clicking the same schema - clear selection
            onSchemaChange('')
            onTableChange('')
        } else {
            // Select new schema
            onSchemaChange(schema.schema_id)
            onTableChange('') // Clear table selection when schema changes
        }
        setSchemaDropdownOpen(false)
    }

    // Handle table selection
    const handleTableSelect = (table: typeof normTables[0] | { schema_table_id: string, table_name: string }) => {
        onTableChange(selectedTableId === table.schema_table_id ? '' : table.schema_table_id || '')
        setTableDropdownOpen(false)
    }

    return (
        <div className={`hierarchical-selector-container ${className}`}>
            {/* Schema Selector (hidden in tablesOnly mode) */}
            {!tablesOnly && (
                <div className="selector-wrapper dropup" ref={schemaDropdownRef}>
                    <button
                        type="button"
                        className={`selector-button schema-button ${schemaDropdownOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && setSchemaDropdownOpen(!schemaDropdownOpen)}
                        disabled={disabled}
                        title="Select schema"
                    >
                        <div className="selector-content">
                            <Database className="selector-icon" size={14} />
                            <span className="selector-text">{getSchemaDisplayText()}</span>
                            {loadingSchemas ? (
                                <Loader2 className="spinner-small" size={12} />
                            ) : (
                                <ChevronDown className={`chevron ${schemaDropdownOpen ? 'open' : ''}`} size={12} />
                            )}
                        </div>
                    </button>

                    {schemaDropdownOpen && (
                        <div className="selector-dropdown dropup">
                            <div className="dropdown-content">
                                {/* All Schemas option */}
                                <div
                                    className={`dropdown-item ${!selectedSchemaId ? 'selected' : ''}`}
                                    onClick={() => handleSchemaSelect({ schema_id: '', schema_name: 'All Schemas' })}
                                >
                                    <Database className="item-icon" size={14} />
                                    <span className="item-text">All Schemas</span>
                                </div>

                                {/* Individual schemas */}
                                {normSchemas.map(schema => (
                                    <div
                                        key={schema.schema_id}
                                        className={`dropdown-item ${selectedSchemaId === schema.schema_id ? 'selected' : ''}`}
                                        onClick={() => handleSchemaSelect(schema)}
                                    >
                                        <Database className="item-icon" size={14} />
                                        <span className="item-text">
                                            {schema.schema_name || `Schema ${schema.schema_id}`}
                                        </span>
                                    </div>
                                ))}

                                {normSchemas.length === 0 && !loadingSchemas && (
                                    <div className="dropdown-item no-data">
                                        <Database className="item-icon" size={14} />
                                        <span>No schemas available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Table Selector */}
            {(forceShowTables || tablesOnly || selectedSchemaId) && (
                <div className="selector-wrapper dropup" ref={tableDropdownRef}>
                    <button
                        type="button"
                        className={`selector-button table-button ${tableDropdownOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && setTableDropdownOpen(!tableDropdownOpen)}
                        disabled={disabled}
                        title="Select table"
                    >
                        <div className="selector-content">
                            <Table className="selector-icon" size={14} />
                            <span className="selector-text">{getTableDisplayText()}</span>
                            {loadingTables ? (
                                <Loader2 className="spinner-small" size={12} />
                            ) : (
                                <ChevronDown className={`chevron ${tableDropdownOpen ? 'open' : ''}`} size={12} />
                            )}
                        </div>
                    </button>

                    {tableDropdownOpen && (
                        <div className="selector-dropdown dropup">
                            <div className="dropdown-content">
                                {/* All Tables option */}
                                <div
                                    className={`dropdown-item ${!selectedTableId ? 'selected' : ''}`}
                                    onClick={() => handleTableSelect({ schema_table_id: '', table_name: 'All Tables' })}
                                >
                                    <Table className="item-icon" size={14} />
                                    <span className="item-text">All Tables</span>
                                </div>

                                {/* Individual tables */}
                                {normTables.map(table => (
                                    <div
                                        key={table.schema_table_id}
                                        className={`dropdown-item ${selectedTableId === table.schema_table_id ? 'selected' : ''}`}
                                        onClick={() => handleTableSelect(table)}
                                    >
                                        <Table className="item-icon" size={14} />
                                        <span className="item-text">
                                            {table.table_name || `Table ${table.schema_table_id}`}
                                        </span>
                                    </div>
                                ))}

                                {normTables.length === 0 && !loadingTables && (
                                    <div className="dropdown-item no-data">
                                        <Table className="item-icon" size={14} />
                                        <span>No tables found</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
