import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
    FaExpand,
    FaCompress,
    FaDatabase,
    FaSortUp,
    FaSortDown,
    FaSpinner,
    FaSync,
    FaTable,
    FaColumns,
    FaFilter,
    FaSort,
    FaFileExport,
    FaTrash,
    FaTimes,
    FaCheck,
    FaPlus,
    FaKey,
    FaLink,
    FaArrowLeft,
    FaSave,
    FaUndo,
} from 'react-icons/fa'
import { DataGridProvider, useDataGridContext, DEFAULT_ROW_HEIGHT } from './DataGridContext'
import type { Column, ActiveFilter, SortOrder, DataGridProps, Filter } from './types'
import { SQL_FILTERS, FILTER_GROUPS, getColumnSize } from './types'
import './data-grid.css'

// ============================================================================
// TableHeader Component
// ============================================================================

interface TableHeaderCellProps {
    column: Column
    width: number
    orderBy: SortOrder
    onSort: () => void
    onResize: (width: number) => void
    position: 'first' | 'middle' | 'last'
}

function TableHeaderCell({
    column,
    width,
    orderBy,
    onSort,
    onResize,
    position
}: TableHeaderCellProps) {
    const [isResizing, setIsResizing] = useState(false)
    const startXRef = useRef(0)
    const startWidthRef = useRef(width)
    const sortOrder = orderBy[column.id]

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        startXRef.current = e.clientX
        startWidthRef.current = width
    }, [width])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - startXRef.current
            const newWidth = Math.max(80, startWidthRef.current + diff)
            onResize(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, onResize])

    return (
        <th
            className={`grid-th ${sortOrder ? 'sorted' : ''}`}
            style={{ width, minWidth: 80 }}
            data-position={position}
        >
            <div className="th-content">
                <div className="th-label" onClick={onSort}>
                    <span className="th-text">
                        {column.isPrimaryKey && <FaKey size={10} className="column-icon primary" />}
                        {column.isForeignKey && <FaLink size={10} className="column-icon foreign" />}
                        {column.name}
                    </span>
                    {sortOrder && (
                        <span className="sort-indicator">
                            {sortOrder === 'ASC' ? (
                                <FaSortUp size={12} className="sort-icon" />
                            ) : (
                                <FaSortDown size={12} className="sort-icon" />
                            )}
                        </span>
                    )}
                </div>
                <div
                    className={`column-resizer ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={handleResizeStart}
                />
            </div>
        </th>
    )
}

// ============================================================================
// Toolbar Components
// ============================================================================

interface ToolbarProps {
    tableName?: string
    rowCount: number
    totalCount?: number
    hasMore?: boolean
    loading?: boolean
    isFullscreen: boolean
    selectedCount: number
    hiddenColumnCount: number
    filterCount: number
    sortCount: number
    readOnly?: boolean
    onToggleFullscreen: () => void
    onRefresh?: () => void
    onExportCSV: () => void
    onOpenFilters: () => void
    onOpenColumns: () => void
    onOpenSort: () => void
    onDeleteSelected?: () => void
    onAddRow?: () => void
    // Navigation
    canNavigateBack?: boolean
    onNavigateBack?: () => void
    // Pending changes
    pendingChangesCount?: number
    isSaving?: boolean
    onSaveChanges?: () => void
    onDiscardChanges?: () => void
}

function Toolbar({
    tableName,
    rowCount,
    totalCount,
    hasMore,
    loading,
    isFullscreen,
    selectedCount,
    hiddenColumnCount,
    filterCount,
    sortCount,
    readOnly = true,
    onToggleFullscreen,
    onRefresh,
    onExportCSV,
    onOpenFilters,
    onOpenColumns,
    onOpenSort,
    onDeleteSelected,
    onAddRow,
    canNavigateBack,
    onNavigateBack,
    pendingChangesCount = 0,
    isSaving = false,
    onSaveChanges,
    onDiscardChanges,
}: ToolbarProps) {
    return (
        <div className="grid-toolbar">
            <div className="toolbar-left">
                {/* Back button for FK navigation */}
                {canNavigateBack && onNavigateBack && (
                    <button
                        className="toolbar-icon-btn back-btn"
                        onClick={onNavigateBack}
                        title="Go back to previous table"
                    >
                        <FaArrowLeft size={14} />
                        <span style={{ marginLeft: 4 }}>Back</span>
                    </button>
                )}
                {tableName && (
                    <div className="row-count">
                        <FaTable size={12} />
                        <span className="badge">{tableName}</span>
                        {loading ? (
                            <span className="loading-text">
                                <FaSpinner className="spinning" size={10} />
                                Loading...
                            </span>
                        ) : totalCount !== undefined ? (
                            <span>{totalCount.toLocaleString()} rows</span>
                        ) : (
                            <span>{rowCount} rows</span>
                        )}
                    </div>
                )}

                {/* Add Row button - shown when not in read-only mode */}
                {!readOnly && onAddRow && (
                    <button
                        className="toolbar-icon-btn"
                        onClick={onAddRow}
                        title="Add new row"
                    >
                        <FaPlus size={12} />
                    </button>
                )}

                {/* Selection actions - just icons when rows selected */}
                {selectedCount > 0 && (
                    <div className="selection-actions">

                        {onDeleteSelected && (
                            <button
                                className="selection-action-btn delete-btn"
                                onClick={onDeleteSelected}
                                title={`Delete ${selectedCount} selected row${selectedCount > 1 ? 's' : ''}`}
                            >
                                <FaTrash size={12} />
                            </button>
                        )}
                    </div>
                )}
                {/* Pending changes indicator with save/cancel buttons */}
                {pendingChangesCount > 0 && (
                    <div className="pending-changes-info">
                        <span className="pending-changes-badge">
                            {pendingChangesCount} unsaved {pendingChangesCount === 1 ? 'change' : 'changes'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                className="pending-save-btn"
                                onClick={onSaveChanges}
                                title="Save all changes"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                className="pending-discard-btn"
                                onClick={onDiscardChanges}
                                title="Discard all changes"
                                disabled={isSaving}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="toolbar-right">
                {/* Filter button */}
                <button
                    className={`toolbar-icon-btn ${filterCount > 0 ? 'active' : ''}`}
                    onClick={onOpenFilters}
                    title="Filters"
                >
                    <FaFilter size={14} />
                    {filterCount > 0 && <span className="btn-badge">{filterCount}</span>}
                </button>

                {/* Sort button */}
                <button
                    className={`toolbar-icon-btn ${sortCount > 0 ? 'active' : ''}`}
                    onClick={onOpenSort}
                    title="Sort Order"
                >
                    <FaSort size={14} />
                    {sortCount > 0 && <span className="btn-badge">{sortCount}</span>}
                </button>

                {/* Columns button */}
                <button
                    className={`toolbar-icon-btn ${hiddenColumnCount > 0 ? 'active' : ''}`}
                    onClick={onOpenColumns}
                    title="Column Visibility"
                >
                    <FaColumns size={14} />
                    {hiddenColumnCount > 0 && <span className="btn-badge">{hiddenColumnCount}</span>}
                </button>

                <div className="toolbar-divider" />

                {onRefresh && (
                    <button
                        className="toolbar-icon-btn"
                        onClick={onRefresh}
                        title="Refresh"
                        disabled={loading}
                    >
                        <FaSync size={14} className={loading ? 'spinning' : ''} />
                    </button>
                )}

                <button
                    className="toolbar-icon-btn"
                    onClick={onExportCSV}
                    title="Export CSV"
                >
                    <FaFileExport size={14} />
                </button>

                <button
                    className="toolbar-icon-btn"
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
                </button>
            </div>
        </div>
    )
}

// ============================================================================
// Filter Components
// ============================================================================

interface FilterPanelProps {
    columns: Column[]
    filters: ActiveFilter[]
    onAddFilter: (filter: ActiveFilter) => void
    onRemoveFilter: (index: number) => void
    onUpdateFilter: (index: number, filter: ActiveFilter) => void
    isOpen: boolean
    onClose: () => void
}

function FilterPanel({
    columns,
    filters,
    onAddFilter,
    onRemoveFilter,
    onUpdateFilter,
    isOpen,
    onClose,
}: FilterPanelProps) {
    const [step, setStep] = useState<'column' | 'operator' | 'value'>('column')
    const [selectedColumn, setSelectedColumn] = useState<string>('')
    const [selectedOperator, setSelectedOperator] = useState<Filter | null>(null)
    const [filterValue, setFilterValue] = useState('')
    const [searchTerm, setSearchTerm] = useState('')

    const filteredColumns = useMemo(() =>
        columns.filter(col =>
            col.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [columns, searchTerm]
    )

    const groupedFilters = useMemo(() => {
        const groups: Record<string, Filter[]> = {}
        SQL_FILTERS.forEach(filter => {
            if (!groups[filter.group]) {
                groups[filter.group] = []
            }
            groups[filter.group].push(filter)
        })
        return groups
    }, [])

    const handleSelectColumn = (columnId: string) => {
        setSelectedColumn(columnId)
        setStep('operator')
        setSearchTerm('')
    }

    const handleSelectOperator = (filter: Filter) => {
        setSelectedOperator(filter)
        if (filter.hasValue === false) {
            // No value needed (IS NULL, IS NOT NULL)
            handleApplyFilter(filter, [])
        } else {
            setStep('value')
        }
    }

    const handleApplyFilter = (operator?: Filter, values?: string[]) => {
        const op = operator || selectedOperator
        if (!op) return

        onAddFilter({
            column: selectedColumn,
            ref: op,
            values: values || (filterValue ? (op.isArray ? filterValue.split(',').map(v => v.trim()) : [filterValue]) : []),
        })
        resetForm()
        onClose()
    }

    const resetForm = () => {
        setStep('column')
        setSelectedColumn('')
        setSelectedOperator(null)
        setFilterValue('')
        setSearchTerm('')
    }

    if (!isOpen) return null

    return (
        <div className="filter-panel-overlay" onClick={onClose}>
            <div className="filter-panel" onClick={e => e.stopPropagation()}>
                <div className="filter-panel-header">
                    <h3>Add Filter</h3>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes size={14} />
                    </button>
                </div>

                <div className="filter-panel-content">
                    {step === 'column' && (
                        <div className="filter-step">
                            <input
                                type="text"
                                className="filter-search"
                                placeholder="Search columns..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            <div className="filter-list">
                                {filteredColumns.map(col => (
                                    <button
                                        key={col.id}
                                        className="filter-list-item"
                                        onClick={() => handleSelectColumn(col.id)}
                                    >
                                        <FaDatabase size={12} className="item-icon" />
                                        <span className="item-name">{col.name}</span>
                                        {col.type && (
                                            <span className="item-type">{col.type}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'operator' && (
                        <div className="filter-step">
                            <div className="step-header">
                                <button className="back-btn" onClick={() => setStep('column')}>
                                    ← Back
                                </button>
                                <span className="selected-column">{selectedColumn}</span>
                            </div>
                            <div className="filter-list grouped">
                                {Object.entries(groupedFilters).map(([group, filters]) => (
                                    <div key={group} className="filter-group">
                                        <div className="group-label">{FILTER_GROUPS[group]}</div>
                                        {filters.map(filter => (
                                            <button
                                                key={filter.operator}
                                                className="filter-list-item"
                                                onClick={() => handleSelectOperator(filter)}
                                            >
                                                <FaFilter size={12} className="item-icon" />
                                                <span className="item-name">{filter.label}</span>
                                                <span className="item-operator">{filter.operator}</span>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'value' && (
                        <div className="filter-step">
                            <div className="step-header">
                                <button className="back-btn" onClick={() => setStep('operator')}>
                                    ← Back
                                </button>
                                <span className="selected-filter">
                                    {selectedColumn} {selectedOperator?.operator}
                                </span>
                            </div>
                            <div className="value-input-container">
                                <input
                                    type="text"
                                    className="filter-value-input"
                                    placeholder={`Enter value for ${selectedColumn}...`}
                                    value={filterValue}
                                    onChange={e => setFilterValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleApplyFilter()
                                    }}
                                    autoFocus
                                />
                                {selectedOperator?.operator.toLowerCase().includes('like') && (
                                    <div className="filter-tip">
                                        Tip: Use <kbd>%</kbd> as wildcard
                                    </div>
                                )}
                                {selectedOperator?.isArray && (
                                    <div className="filter-tip">
                                        Tip: Separate multiple values with <kbd>,</kbd>
                                    </div>
                                )}
                                <button
                                    className="apply-filter-btn"
                                    onClick={() => handleApplyFilter()}
                                >
                                    Apply Filter
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Active Filters Display
// ============================================================================

interface ActiveFiltersBarProps {
    filters: ActiveFilter[]
    onRemoveFilter: (index: number) => void
    onClearAll: () => void
}

function ActiveFiltersBar({ filters, onRemoveFilter, onClearAll }: ActiveFiltersBarProps) {
    if (filters.length === 0) return null

    return (
        <div className="active-filters-bar">
            {filters.map((filter, index) => (
                <div key={index} className="active-filter-chip">
                    <span className="filter-column">{filter.column}</span>
                    <span className="filter-operator">{filter.ref.operator}</span>
                    {filter.values.length > 0 && (
                        <span className="filter-value">
                            {filter.values.join(', ')}
                        </span>
                    )}
                    <button
                        className="remove-filter-btn"
                        onClick={() => onRemoveFilter(index)}
                    >
                        <FaTimes size={10} />
                    </button>
                </div>
            ))}
            {filters.length > 1 && (
                <button className="clear-all-btn" onClick={onClearAll}>
                    Clear all
                </button>
            )}
        </div>
    )
}

// ============================================================================
// Column Visibility Panel
// ============================================================================

interface ColumnsPanelProps {
    columns: Column[]
    hiddenColumns: string[]
    onToggleColumn: (columnId: string) => void
    onShowAll: () => void
    onHideAll: () => void
    isOpen: boolean
    onClose: () => void
}

function ColumnsPanel({
    columns,
    hiddenColumns,
    onToggleColumn,
    onShowAll,
    onHideAll,
    isOpen,
    onClose,
}: ColumnsPanelProps) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredColumns = useMemo(() =>
        columns.filter(col =>
            col.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [columns, searchTerm]
    )

    if (!isOpen) return null

    return (
        <div className="filter-panel-overlay" onClick={onClose}>
            <div className="filter-panel" onClick={e => e.stopPropagation()}>
                <div className="filter-panel-header">
                    <h3>Column Visibility</h3>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes size={14} />
                    </button>
                </div>

                <div className="filter-panel-content">
                    <input
                        type="text"
                        className="filter-search"
                        placeholder="Search columns..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />

                    <div className="bulk-actions">
                        <button onClick={onShowAll}>Show All</button>
                        <button onClick={onHideAll}>Hide All</button>
                    </div>

                    <div className="filter-list">
                        {filteredColumns.map(col => (
                            <button
                                key={col.id}
                                className={`filter-list-item ${!hiddenColumns.includes(col.id) ? 'active' : ''}`}
                                onClick={() => onToggleColumn(col.id)}
                            >
                                <span className="checkbox">
                                    {!hiddenColumns.includes(col.id) && <FaCheck size={10} />}
                                </span>
                                <span className="item-name">{col.name}</span>
                                {col.type && (
                                    <span className="item-type">{col.type}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Sort Panel
// ============================================================================

interface SortPanelProps {
    columns: Column[]
    orderBy: SortOrder
    onToggleSort: (columnId: string) => void
    onSetSort: (columnId: string, direction: 'ASC' | 'DESC') => void
    onRemoveSort: (columnId: string) => void
    onClearAll: () => void
    isOpen: boolean
    onClose: () => void
}

function SortPanel({
    columns,
    orderBy,
    onToggleSort,
    onSetSort,
    onRemoveSort,
    onClearAll,
    isOpen,
    onClose,
}: SortPanelProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const orderEntries = Object.entries(orderBy)

    const availableColumns = useMemo(() =>
        columns.filter(col =>
            !orderBy[col.id] &&
            col.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [columns, orderBy, searchTerm]
    )

    if (!isOpen) return null

    return (
        <div className="filter-panel-overlay" onClick={onClose}>
            <div className="filter-panel sort-panel" onClick={e => e.stopPropagation()}>
                <div className="filter-panel-header">
                    <h3>Sort Order</h3>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes size={14} />
                    </button>
                </div>

                <div className="filter-panel-content">
                    {orderEntries.length > 0 && (
                        <div className="current-sorts">
                            <div className="section-label">
                                Current Sorting
                                {orderEntries.length > 0 && (
                                    <button className="clear-btn" onClick={onClearAll}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            {orderEntries.map(([columnId, direction]) => (
                                <div key={columnId} className="sort-item">
                                    <span className="sort-column">{columnId}</span>
                                    <div className="sort-toggle">
                                        <button
                                            className={`sort-dir-btn ${direction === 'ASC' ? 'active' : ''}`}
                                            onClick={() => onSetSort(columnId, 'ASC')}
                                        >
                                            <FaSortUp size={12} />
                                            ASC
                                        </button>
                                        <button
                                            className={`sort-dir-btn ${direction === 'DESC' ? 'active' : ''}`}
                                            onClick={() => onSetSort(columnId, 'DESC')}
                                        >
                                            <FaSortDown size={12} />
                                            DESC
                                        </button>
                                    </div>
                                    <button
                                        className="remove-sort-btn"
                                        onClick={() => onRemoveSort(columnId)}
                                    >
                                        <FaTimes size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {orderEntries.length === 0 && (
                        <div className="empty-state">
                            <FaSort size={24} className="empty-icon" />
                            <p>No sorting applied</p>
                            <span>Click on column headers or add columns below</span>
                        </div>
                    )}

                    {availableColumns.length > 0 && (
                        <>
                            <div className="section-label">Add Column</div>
                            <input
                                type="text"
                                className="filter-search"
                                placeholder="Search columns..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <div className="filter-list">
                                {availableColumns.slice(0, 10).map(col => (
                                    <button
                                        key={col.id}
                                        className="filter-list-item"
                                        onClick={() => onSetSort(col.id, 'ASC')}
                                    >
                                        <FaPlus size={10} className="item-icon" />
                                        <span className="item-name">{col.name}</span>
                                        {col.type && (
                                            <span className="item-type">{col.type}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Main DataGrid Component
// ============================================================================

export function DataGridNew({
    columns = [],
    data = [],
    loading = false,
    onLoadMore,
    hasMore = false,
    isFetchingMore = false,
    totalCount,
    tableName,
    schema,
    onRefresh,
    onExportCSV,
    readOnly = true,
    error,
    onFilterChange,
    onSortChange,
    onCellEdit,
    onRowDelete,
    onRowInsert,
    onForeignKeyNavigate,
    onSaveSuccess,
    onSaveError,
    canNavigateBack = false,
    onNavigateBack,
}: DataGridProps) {
    // State
    const [columnSizing, setColumnSizing] = useState<Record<string, number>>({})
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
    const [filters, setFilters] = useState<ActiveFilter[]>([])
    const [orderBy, setOrderBy] = useState<SortOrder>({})
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([])

    // Pending changes state: Map of cellKey (rowIndex::colId) -> { originalValue, newValue }
    const [pendingChanges, setPendingChanges] = useState<Record<string, { rowIndex: number; colId: string; originalValue: unknown; newValue: unknown }>>({})
    const [isSaving, setIsSaving] = useState(false)

    // New row being added (shows at top of table)
    const [newRow, setNewRow] = useState<Record<string, unknown> | null>(null)
    const [newRowEditing, setNewRowEditing] = useState<string | null>(null)
    const [newRowEditValue, setNewRowEditValue] = useState('')

    // Panel states
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [showColumnsPanel, setShowColumnsPanel] = useState(false)
    const [showSortPanel, setShowSortPanel] = useState(false)

    // Confirmation dialog states
    const [showSaveConfirm, setShowSaveConfirm] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const tableBodyRef = useRef<HTMLTableSectionElement>(null)

    // Visible columns
    const visibleColumns = useMemo(() =>
        columns.filter(col => !hiddenColumns.includes(col.id)),
        [columns, hiddenColumns]
    )

    // Filter the data (client-side) using both quick filter and panel filters
    const filteredData = useMemo(() => {
        let result = data

        // Apply panel filters
        if (filters.length > 0) {
            result = result.filter((row) => {
                return filters.every((filter) => {
                    const cellValue = row[filter.column]
                    const filterValues = filter.values

                    switch (filter.ref.operator) {
                        case '=':
                            return String(cellValue) === filterValues[0]
                        case '!=':
                            return String(cellValue) !== filterValues[0]
                        case '>':
                            return Number(cellValue) > Number(filterValues[0])
                        case '>=':
                            return Number(cellValue) >= Number(filterValues[0])
                        case '<':
                            return Number(cellValue) < Number(filterValues[0])
                        case '<=':
                            return Number(cellValue) <= Number(filterValues[0])
                        case 'LIKE':
                            return String(cellValue).includes(filterValues[0])
                        case 'NOT LIKE':
                            return !String(cellValue).includes(filterValues[0])
                        case 'ILIKE':
                            return String(cellValue).toLowerCase().includes(filterValues[0].toLowerCase())
                        case 'NOT ILIKE':
                            return !String(cellValue).toLowerCase().includes(filterValues[0].toLowerCase())
                        case 'IN':
                            return filterValues.includes(String(cellValue))
                        case 'NOT IN':
                            return !filterValues.includes(String(cellValue))
                        case 'IS NULL':
                            return cellValue === null || cellValue === undefined
                        case 'IS NOT NULL':
                            return cellValue !== null && cellValue !== undefined
                        case 'BETWEEN':
                            const num = Number(cellValue)
                            return num >= Number(filterValues[0]) && num <= Number(filterValues[1])
                        default:
                            return true
                    }
                })
            })
        }

        return result
    }, [data, filters])

    // Get column width
    const getWidth = useCallback((col: Column) => {
        return columnSizing[col.id] || getColumnSize(col.type)
    }, [columnSizing])

    // Primary keys for selection
    const primaryKeys = useMemo(() =>
        columns.filter(col => col.isPrimaryKey).map(col => col.id),
        [columns]
    )

    // Filter and sort handlers
    const handleAddFilter = useCallback((filter: ActiveFilter) => {
        const newFilters = [...filters, filter]
        setFilters(newFilters)
        onFilterChange?.(newFilters)
    }, [filters, onFilterChange])

    const handleRemoveFilter = useCallback((index: number) => {
        const newFilters = filters.filter((_, i) => i !== index)
        setFilters(newFilters)
        onFilterChange?.(newFilters)
    }, [filters, onFilterChange])

    const handleClearFilters = useCallback(() => {
        setFilters([])
        onFilterChange?.([])
    }, [onFilterChange])

    const handleToggleSort = useCallback((columnId: string) => {
        const current = orderBy[columnId]
        let newOrderBy: SortOrder

        if (!current) {
            newOrderBy = { ...orderBy, [columnId]: 'ASC' }
        } else if (current === 'ASC') {
            newOrderBy = { ...orderBy, [columnId]: 'DESC' }
        } else {
            const { [columnId]: _, ...rest } = orderBy
            newOrderBy = rest
        }

        setOrderBy(newOrderBy)
        onSortChange?.(newOrderBy)
    }, [orderBy, onSortChange])

    const handleSetSort = useCallback((columnId: string, direction: 'ASC' | 'DESC') => {
        const newOrderBy = { ...orderBy, [columnId]: direction }
        setOrderBy(newOrderBy)
        onSortChange?.(newOrderBy)
    }, [orderBy, onSortChange])

    const handleRemoveSort = useCallback((columnId: string) => {
        const { [columnId]: _, ...rest } = orderBy
        setOrderBy(rest)
        onSortChange?.(rest)
    }, [orderBy, onSortChange])

    const handleClearSort = useCallback(() => {
        setOrderBy({})
        onSortChange?.({})
    }, [onSortChange])

    // Column visibility handlers
    const handleToggleColumn = useCallback((columnId: string) => {
        if (hiddenColumns.includes(columnId)) {
            setHiddenColumns(hiddenColumns.filter(id => id !== columnId))
        } else {
            setHiddenColumns([...hiddenColumns, columnId])
        }
    }, [hiddenColumns])

    const handleShowAllColumns = useCallback(() => {
        setHiddenColumns([])
    }, [])

    const handleHideAllColumns = useCallback(() => {
        setHiddenColumns(columns.map(col => col.id))
    }, [columns])

    // Column resize handler
    const handleColumnResize = useCallback((columnId: string, width: number) => {
        setColumnSizing(prev => ({ ...prev, [columnId]: width }))
    }, [])

    // Cell editing - store changes locally instead of saving immediately
    const handleCellDoubleClick = useCallback((rowIndex: number, colId: string, value: unknown) => {
        if (readOnly) return
        const cellKey = `${rowIndex}::${colId}`
        setEditingCell(cellKey)
        // If there's already a pending change for this cell, use that value; otherwise use original
        const pendingChange = pendingChanges[cellKey]
        setEditValue(pendingChange
            ? (pendingChange.newValue === null || pendingChange.newValue === undefined ? '' : String(pendingChange.newValue))
            : (value === null || value === undefined ? '' : String(value))
        )
    }, [readOnly, pendingChanges])

    const handleCellBlur = useCallback(() => {
        if (!editingCell) return

        // Use :: as delimiter to safely split rowIndex and colId
        const delimiterIndex = editingCell.indexOf('::')
        if (delimiterIndex === -1) {
            setEditingCell(null)
            return
        }

        const rowIndex = parseInt(editingCell.substring(0, delimiterIndex))
        const colId = editingCell.substring(delimiterIndex + 2)

        // Get the original value from data
        const row = data[rowIndex]
        const originalValue = row ? row[colId] : undefined

        // Only add to pending changes if value actually changed
        const originalStr = originalValue === null || originalValue === undefined ? '' : String(originalValue)
        if (editValue !== originalStr) {
            // Check if we're reverting to original value
            if (editValue === originalStr) {
                // Remove from pending changes if reverting
                setPendingChanges(prev => {
                    const newChanges = { ...prev }
                    delete newChanges[editingCell]
                    return newChanges
                })
            } else {
                // Add or update pending change
                setPendingChanges(prev => ({
                    ...prev,
                    [editingCell]: {
                        rowIndex,
                        colId,
                        originalValue,
                        newValue: editValue,
                    }
                }))
            }
        }

        setEditingCell(null)
    }, [editingCell, editValue, data])

    const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleCellBlur()
        } else if (e.key === 'Escape') {
            // Cancel editing without saving
            e.preventDefault()
            setEditingCell(null)
        }
    }, [handleCellBlur])

    // Save all pending changes - show confirmation first
    const handleSaveChanges = useCallback(() => {
        if (!onCellEdit || Object.keys(pendingChanges).length === 0) return
        setShowSaveConfirm(true)
    }, [onCellEdit, pendingChanges])

    // Confirm save
    const handleConfirmSave = useCallback(async () => {
        if (!onCellEdit || Object.keys(pendingChanges).length === 0) return

        setIsSaving(true)
        setShowSaveConfirm(false)
        try {
            // Process all pending changes
            for (const [, change] of Object.entries(pendingChanges)) {
                await onCellEdit(change.rowIndex, change.colId, change.newValue)
            }
            // Clear pending changes on success
            setPendingChanges({})
            // Call success callback
            onSaveSuccess?.()
        } catch (error) {
            console.error('Failed to save changes:', error)
            // Call error callback
            onSaveError?.(error instanceof Error ? error : new Error('Failed to save changes'))
        } finally {
            setIsSaving(false)
        }
    }, [pendingChanges, onCellEdit, onSaveSuccess, onSaveError])

    // Discard all pending changes
    const handleDiscardChanges = useCallback(() => {
        setPendingChanges({})
    }, [])

    // Add new row - creates a local row for editing before saving
    const handleAddRow = useCallback(() => {
        // Create a new row with default values based on columns
        const row: Record<string, unknown> = {}
        for (const col of columns) {
            // Use the column's defaultValue if available
            if (col.defaultValue !== undefined && col.defaultValue !== null) {
                // Store the default value expression as-is (e.g., "nextval('sequence_name')")
                row[col.id] = col.defaultValue
            } else if (col.isNullable) {
                row[col.id] = null
            } else if (col.type?.toLowerCase().includes('int') || col.type?.toLowerCase().includes('numeric')) {
                row[col.id] = 0
            } else if (col.type?.toLowerCase().includes('bool')) {
                row[col.id] = false
            } else {
                row[col.id] = ''
            }
        }
        setNewRow(row)
    }, [columns])

    // Save the new row to the database
    const handleSaveNewRow = useCallback(async () => {
        if (!onRowInsert || !newRow) return

        // Prepare the row data - convert default value expressions to undefined so the database uses them
        const rowToInsert: Record<string, unknown> = {}
        for (const col of columns) {
            const value = newRow[col.id]
            // If the value is still the default expression (like nextval()), don't include it
            // so the database will use the default
            if (col.defaultValue !== undefined && col.defaultValue !== null && value === col.defaultValue) {
                // Skip - let the database use the default
                continue
            }
            rowToInsert[col.id] = value
        }

        try {
            await onRowInsert(rowToInsert)
            setNewRow(null)
            setNewRowEditing(null)
            onRefresh?.()
        } catch (error) {
            console.error('Failed to add row:', error)
        }
    }, [columns, newRow, onRowInsert, onRefresh])

    // Cancel adding new row
    const handleCancelNewRow = useCallback(() => {
        setNewRow(null)
        setNewRowEditing(null)
    }, [])

    // Edit cell in new row
    const handleNewRowCellDoubleClick = useCallback((colId: string, value: unknown) => {
        setNewRowEditing(colId)
        setNewRowEditValue(value === null || value === undefined ? '' : String(value))
    }, [])

    const handleNewRowCellBlur = useCallback(() => {
        if (!newRowEditing || !newRow) return
        setNewRow(prev => prev ? { ...prev, [newRowEditing]: newRowEditValue } : null)
        setNewRowEditing(null)
    }, [newRowEditing, newRow, newRowEditValue])

    const handleNewRowCellKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleNewRowCellBlur()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setNewRowEditing(null)
        }
    }, [handleNewRowCellBlur])



    // Delete selected rows - show confirmation first
    const handleDeleteSelected = useCallback(() => {
        if (!onRowDelete || selectedRows.size === 0) return
        setShowDeleteConfirm(true)
    }, [onRowDelete, selectedRows.size])

    // Confirm delete
    const handleConfirmDelete = useCallback(async () => {
        if (!onRowDelete || selectedRows.size === 0) return

        const rowsToDelete = Array.from(selectedRows).map(i => filteredData[i]).filter(Boolean)
        if (rowsToDelete.length === 0) return

        try {
            await onRowDelete(rowsToDelete)
            setSelectedRows(new Set())
            setShowDeleteConfirm(false)
            onRefresh?.()
        } catch (error) {
            console.error('Failed to delete rows:', error)
            setShowDeleteConfirm(false)
        }
    }, [selectedRows, filteredData, onRowDelete, onRefresh])

    // Row selection
    const handleRowClick = useCallback((rowIndex: number) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev)
            if (newSet.has(rowIndex)) {
                newSet.delete(rowIndex)
            } else {
                newSet.add(rowIndex)
            }
            return newSet
        })
    }, [])

    const handleSelectAll = useCallback(() => {
        if (selectedRows.size === filteredData.length) {
            setSelectedRows(new Set())
        } else {
            setSelectedRows(new Set(filteredData.map((_, i) => i)))
        }
    }, [filteredData, selectedRows])

    // Export CSV
    const handleExportCSV = useCallback(() => {
        if (onExportCSV) {
            onExportCSV()
            return
        }

        const headers = visibleColumns.map(c => c.name).join(',')
        const rows = data.map(row =>
            visibleColumns.map(col => {
                const cell = row[col.id]
                if (cell === null || cell === undefined) return ''
                const str = String(cell)
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                }
                return str
            }).join(',')
        ).join('\n')

        const csv = `${headers}\n${rows}`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tableName || 'data'}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [visibleColumns, data, tableName, onExportCSV])

    // Infinite scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!hasMore || loading || !onLoadMore) return

        const container = e.currentTarget
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight

        if (scrollBottom < 100) {
            onLoadMore()
        }
    }, [hasMore, loading, onLoadMore])

    // Render cell
    const renderCell = (value: unknown, rowIndex: number, colId: string) => {
        const cellKey = `${rowIndex}::${colId}`
        const isEditing = editingCell === cellKey
        const column = columns.find(c => c.id === colId)
        const isForeignKey = column?.isForeignKey && column?.foreignTable

        // Check if this cell has pending changes
        const pendingChange = pendingChanges[cellKey]
        const displayValue = pendingChange ? pendingChange.newValue : value

        if (isEditing) {
            return (
                <input
                    type="text"
                    className="cell-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCellBlur}
                    onKeyDown={handleCellKeyDown}
                    autoFocus
                />
            )
        }

        if (displayValue === null || displayValue === undefined) {
            return <span className="null-value">NULL</span>
        }

        if (typeof displayValue === 'boolean') {
            return <span className="bool-value">{displayValue ? 'true' : 'false'}</span>
        }

        if (typeof displayValue === 'object') {
            return <span className="json-value">{JSON.stringify(displayValue)}</span>
        }

        // Render foreign key cell with navigation icon
        if (isForeignKey && onForeignKeyNavigate && displayValue) {
            return (
                <div className="foreign-key-cell">
                    <span className="fk-value">{String(displayValue)}</span>
                    <button
                        className="fk-navigate-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            onForeignKeyNavigate(
                                column.foreignTable!,
                                schema || 'public',
                                column.foreignColumn || 'id',
                                displayValue
                            )
                        }}
                        title={`Go to ${column.foreignTable}`}
                    >
                        <FaLink size={10} />
                    </button>
                </div>
            )
        }

        return <span>{String(displayValue)}</span>
    }

    // Render cell for new row
    const renderNewRowCell = (colId: string) => {
        if (!newRow) return null

        const column = columns.find(c => c.id === colId)
        const value = newRow[colId]
        const isEditing = newRowEditing === colId
        const isDefaultValue = column?.defaultValue !== undefined &&
            column?.defaultValue !== null &&
            value === column.defaultValue

        if (isEditing) {
            return (
                <input
                    type="text"
                    className="cell-input"
                    value={newRowEditValue}
                    onChange={(e) => setNewRowEditValue(e.target.value)}
                    onBlur={handleNewRowCellBlur}
                    onKeyDown={handleNewRowCellKeyDown}
                    autoFocus
                />
            )
        }

        // Show default value expressions (like nextval()) with special styling
        if (isDefaultValue) {
            return <span className="default-value">{String(value)}</span>
        }

        if (value === null || value === undefined) {
            return <span className="null-value">NULL</span>
        }

        if (typeof value === 'boolean') {
            return <span className="bool-value">{value ? 'true' : 'false'}</span>
        }

        return <span>{String(value)}</span>
    }

    // Check if a cell has pending changes (for styling)
    const hasPendingChange = useCallback((rowIndex: number, colId: string) => {
        return !!pendingChanges[`${rowIndex}::${colId}`]
    }, [pendingChanges])

    // Error state - show error message
    if (error) {
        return (
            <div className={`modern-data-grid ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
                <Toolbar
                    tableName={tableName}
                    rowCount={0}
                    loading={loading}
                    isFullscreen={isFullscreen}
                    selectedCount={0}
                    hiddenColumnCount={hiddenColumns.length}
                    filterCount={filters.length}
                    sortCount={Object.keys(orderBy).length}
                    readOnly={readOnly}
                    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    onRefresh={onRefresh}
                    onExportCSV={handleExportCSV}
                    onOpenFilters={() => setShowFilterPanel(true)}
                    onOpenColumns={() => setShowColumnsPanel(true)}
                    onOpenSort={() => setShowSortPanel(true)}
                    canNavigateBack={canNavigateBack}
                    onNavigateBack={onNavigateBack}
                />

                <div className="grid-error">
                    <div className="error-icon">⚠️</div>
                    <div className="error-title">Failed to load data</div>
                    <div className="error-message">{error}</div>
                    {onRefresh && (
                        <button className="error-retry-btn" onClick={onRefresh}>
                            <FaSync size={12} />
                            <span>Retry</span>
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Empty state - show headers with no data message
    if (!loading && data.length === 0 && filters.length === 0) {
        return (
            <div className={`modern-data-grid ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
                <Toolbar
                    tableName={tableName}
                    rowCount={0}
                    loading={loading}
                    isFullscreen={isFullscreen}
                    selectedCount={0}
                    hiddenColumnCount={hiddenColumns.length}
                    filterCount={filters.length}
                    sortCount={Object.keys(orderBy).length}
                    readOnly={readOnly}
                    onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                    onRefresh={onRefresh}
                    onExportCSV={handleExportCSV}
                    onOpenFilters={() => setShowFilterPanel(true)}
                    onOpenColumns={() => setShowColumnsPanel(true)}
                    onOpenSort={() => setShowSortPanel(true)}
                    onAddRow={handleAddRow}
                    onDeleteSelected={handleDeleteSelected}
                    canNavigateBack={canNavigateBack}
                    onNavigateBack={onNavigateBack}
                    pendingChangesCount={Object.keys(pendingChanges).length}
                    isSaving={isSaving}
                    onSaveChanges={handleSaveChanges}
                    onDiscardChanges={handleDiscardChanges}
                />

                {/* Show table with headers but no data */}
                <div className="grid-table-container">
                    <table className="grid-table">
                        {/* Colgroup for consistent column widths */}
                        <colgroup>
                            <col style={{ width: 50, minWidth: 50 }} />
                            {visibleColumns.map((column) => (
                                <col
                                    key={column.id}
                                    style={{ width: getWidth(column), minWidth: 80 }}
                                />
                            ))}
                        </colgroup>

                        <thead className="grid-thead">
                            <tr className="grid-header-row">
                                {/* Row number header */}
                                <th className="grid-th row-number-header">
                                    <div className="th-content">
                                        <span className="th-text">#</span>
                                    </div>
                                </th>

                                {visibleColumns.map((column, colIndex) => (
                                    <TableHeaderCell
                                        key={column.id}
                                        column={column}
                                        width={getWidth(column)}
                                        orderBy={orderBy}
                                        onSort={() => handleToggleSort(column.id)}
                                        onResize={(width) => handleColumnResize(column.id, width)}
                                        position={colIndex === 0 ? 'first' : colIndex === visibleColumns.length - 1 ? 'last' : 'middle'}
                                    />
                                ))}
                            </tr>
                        </thead>
                        <tbody className="grid-tbody">
                            <tr className="grid-row empty-row">
                                <td
                                    className="grid-cell empty-cell"
                                    colSpan={visibleColumns.length + 1}
                                >
                                    <div className="empty-data-message">
                                        <FaDatabase className="empty-icon" />
                                        <span>No data found</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    return (
        <div className={`modern-data-grid ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
            {/* Toolbar */}
            <Toolbar
                tableName={tableName}
                rowCount={filteredData.length}
                totalCount={totalCount}
                hasMore={hasMore}
                loading={loading}
                isFullscreen={isFullscreen}
                selectedCount={selectedRows.size}
                hiddenColumnCount={hiddenColumns.length}
                filterCount={filters.length}
                sortCount={Object.keys(orderBy).length}
                readOnly={readOnly}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                onRefresh={onRefresh}
                onExportCSV={handleExportCSV}
                onOpenFilters={() => setShowFilterPanel(true)}
                onOpenColumns={() => setShowColumnsPanel(true)}
                onOpenSort={() => setShowSortPanel(true)}
                onAddRow={handleAddRow}
                onDeleteSelected={handleDeleteSelected}
                canNavigateBack={canNavigateBack}
                onNavigateBack={onNavigateBack}
                pendingChangesCount={Object.keys(pendingChanges).length}
                isSaving={isSaving}
                onSaveChanges={handleSaveChanges}
                onDiscardChanges={handleDiscardChanges}
            />

            {/* Active Filters */}
            <ActiveFiltersBar
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearFilters}
            />

            {/* Table Container */}
            <div
                className="grid-table-container"
                onScroll={handleScroll}
            >
                <table className="grid-table">
                    {/* Colgroup for consistent column widths */}
                    <colgroup>
                        {primaryKeys.length > 0 && <col style={{ width: 40, minWidth: 40 }} />}
                        <col style={{ width: 50, minWidth: 50 }} />
                        {visibleColumns.map((column) => (
                            <col
                                key={column.id}
                                style={{ width: getWidth(column), minWidth: 80 }}
                            />
                        ))}
                    </colgroup>

                    {/* Header */}
                    <thead className="grid-thead">
                        <tr className="grid-header-row">
                            {/* Selection checkbox header */}
                            {primaryKeys.length > 0 && (
                                <th className="grid-th checkbox-header">
                                    <div className="checkbox-cell" onClick={handleSelectAll}>
                                        <span className={`checkbox ${selectedRows.size === filteredData.length && filteredData.length > 0 ? 'checked' : ''}`}>
                                            {selectedRows.size === filteredData.length && filteredData.length > 0 && <FaCheck size={10} />}
                                        </span>
                                    </div>
                                </th>
                            )}

                            {/* Row number header */}
                            <th className="grid-th row-number-header">
                                <div className="th-content">
                                    <span className="th-text">#</span>
                                </div>
                            </th>

                            {visibleColumns.map((column, colIndex) => (
                                <TableHeaderCell
                                    key={column.id}
                                    column={column}
                                    width={getWidth(column)}
                                    orderBy={orderBy}
                                    onSort={() => handleToggleSort(column.id)}
                                    onResize={(width) => handleColumnResize(column.id, width)}
                                    position={colIndex === 0 ? 'first' : colIndex === visibleColumns.length - 1 ? 'last' : 'middle'}
                                />
                            ))}
                        </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="grid-tbody" ref={tableBodyRef}>
                        {/* New row being added - shows at top */}
                        {newRow && (
                            <tr className="grid-row new-row">
                                {/* Empty checkbox cell for new row */}
                                {primaryKeys.length > 0 && (
                                    <td className="grid-cell checkbox-cell">
                                        <span className="new-row-indicator">+</span>
                                    </td>
                                )}

                                {/* New row label */}
                                <td className="grid-cell row-number-cell new-row-label">
                                    <span>NEW</span>
                                </td>

                                {visibleColumns.map((column) => (
                                    <td
                                        key={column.id}
                                        className="grid-cell new-row-cell"
                                        onDoubleClick={() => handleNewRowCellDoubleClick(column.id, newRow[column.id])}
                                    >
                                        <div className="cell-content-wrapper">
                                            {renderNewRowCell(column.id)}
                                        </div>
                                    </td>
                                ))}

                                {/* Save/Discard buttons */}
                                <td className="grid-cell new-row-actions">
                                    <button
                                        className="new-row-btn save"
                                        onClick={handleSaveNewRow}
                                        title="Save new row"
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="new-row-btn cancel"
                                        onClick={handleCancelNewRow}
                                        title="Discard"
                                    >
                                        Discard
                                    </button>
                                </td>
                            </tr>
                        )}
                        {filteredData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`grid-row ${selectedRows.has(rowIndex) ? 'selected' : ''}`}
                            >
                                {/* Selection checkbox */}
                                {primaryKeys.length > 0 && (
                                    <td className="grid-cell checkbox-cell" onClick={() => handleRowClick(rowIndex)}>
                                        <span className={`checkbox ${selectedRows.has(rowIndex) ? 'checked' : ''}`}>
                                            {selectedRows.has(rowIndex) && <FaCheck size={10} />}
                                        </span>
                                    </td>
                                )}

                                {/* Row number */}
                                <td className="grid-cell row-number-cell">
                                    {rowIndex + 1}
                                </td>

                                {visibleColumns.map((column) => (
                                    <td
                                        key={column.id}
                                        className={`grid-cell ${hasPendingChange(rowIndex, column.id) ? 'cell-modified' : ''}`}
                                        onDoubleClick={() => handleCellDoubleClick(rowIndex, column.id, row[column.id])}
                                    >
                                        <div className="cell-content-wrapper">
                                            {renderCell(row[column.id], rowIndex, column.id)}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Loading indicator */}
                {loading && (
                    <div className="grid-loading">
                        <FaSpinner size={16} className="spinning" />
                        <span>Loading...</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            {(hasMore || data.length > 0) && (
                <div className="grid-footer">
                    <div className="pagination-info">
                        Showing {filteredData.length}
                        {filteredData.length !== data.length && ` of ${data.length}`}
                        {' '}rows
                        {isFetchingMore && (
                            <span className="loading-more">
                                <FaSpinner size={10} className="spinning" />
                                Loading more...
                            </span>
                        )}
                        {hasMore && !isFetchingMore && ' (scroll for more)'}
                    </div>
                </div>
            )}

            {/* Panels */}
            <FilterPanel
                columns={columns}
                filters={filters}
                onAddFilter={handleAddFilter}
                onRemoveFilter={handleRemoveFilter}
                onUpdateFilter={(index, filter) => {
                    const newFilters = [...filters]
                    newFilters[index] = filter
                    setFilters(newFilters)
                    onFilterChange?.(newFilters)
                }}
                isOpen={showFilterPanel}
                onClose={() => setShowFilterPanel(false)}
            />

            <ColumnsPanel
                columns={columns}
                hiddenColumns={hiddenColumns}
                onToggleColumn={handleToggleColumn}
                onShowAll={handleShowAllColumns}
                onHideAll={handleHideAllColumns}
                isOpen={showColumnsPanel}
                onClose={() => setShowColumnsPanel(false)}
            />

            <SortPanel
                columns={columns}
                orderBy={orderBy}
                onToggleSort={handleToggleSort}
                onSetSort={handleSetSort}
                onRemoveSort={handleRemoveSort}
                onClearAll={handleClearSort}
                isOpen={showSortPanel}
                onClose={() => setShowSortPanel(false)}
            />

            {/* Save Confirmation Dialog */}
            {showSaveConfirm && (
                <div className="confirm-dialog-overlay" onClick={() => setShowSaveConfirm(false)}>
                    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog-title">Save Changes</div>
                        <div className="confirm-dialog-message">
                            Are you sure you want to save {Object.keys(pendingChanges).length} change{Object.keys(pendingChanges).length > 1 ? 's' : ''}?
                        </div>
                        <div className="confirm-dialog-actions">
                            <button className="confirm-btn cancel" onClick={() => setShowSaveConfirm(false)}>
                                Cancel
                            </button>
                            <button className="confirm-btn confirm" onClick={handleConfirmSave}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && (
                <div className="confirm-dialog-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
                        <div className="confirm-dialog-title">Delete Rows</div>
                        <div className="confirm-dialog-message">
                            Are you sure you want to delete {selectedRows.size} row{selectedRows.size > 1 ? 's' : ''}? This action cannot be undone.
                        </div>
                        <div className="confirm-dialog-actions">
                            <button className="confirm-btn cancel" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="confirm-btn danger" onClick={handleConfirmDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export { DataGridNew as DataGrid }
