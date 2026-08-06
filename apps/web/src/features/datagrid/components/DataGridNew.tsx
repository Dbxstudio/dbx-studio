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
    searchValue?: string
    suggestions?: FilterSuggestion[]
    readOnly?: boolean
    onSearchChange?: (value: string) => void
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
    onCancelChanges?: () => void
    // Properties
    onShowProperties?: () => void
}

type FilterSuggestionKind = 'COLUMN' | 'VALUE' | 'RECENT'

interface FilterSuggestion {
    id: string
    label: string
    kind: FilterSuggestionKind
    applyValue: string
    matchQuery: string
}

const SUGGESTION_KIND_LABEL: Record<FilterSuggestionKind, string> = {
    COLUMN: 'COLUMN',
    VALUE: 'VALUE',
    RECENT: 'RECENT',
}

interface ParsedQuickFilter {
    hasEquals: boolean
    rawColumnInput: string
    normalizedColumnInput: string
    valueInput: string
    normalizedValueInput: string
}

function parseQuickFilterInput(input: string): ParsedQuickFilter {
    const equalsIndex = input.indexOf('=')

    if (equalsIndex === -1) {
        const rawColumnInput = input.trim()
        return {
            hasEquals: false,
            rawColumnInput,
            normalizedColumnInput: rawColumnInput.toLowerCase(),
            valueInput: '',
            normalizedValueInput: '',
        }
    }

    const rawColumnInput = input.slice(0, equalsIndex).trim()
    const valueInput = input.slice(equalsIndex + 1).trim()

    return {
        hasEquals: true,
        rawColumnInput,
        normalizedColumnInput: rawColumnInput.toLowerCase(),
        valueInput,
        normalizedValueInput: valueInput.toLowerCase(),
    }
}

function getColumnAliases(column: Column): string[] {
    return [column.name.toLowerCase(), column.id.toLowerCase()]
}

function resolveColumnFromInput(columns: Column[], normalizedInput: string): Column | null {
    if (!normalizedInput) return null

    const exactMatch = columns.find((column) =>
        getColumnAliases(column).some((alias) => alias === normalizedInput)
    )

    if (exactMatch) return exactMatch

    const partialMatches = columns.filter((column) =>
        getColumnAliases(column).some((alias) => alias.startsWith(normalizedInput))
    )

    return partialMatches.length === 1 ? partialMatches[0] : null
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
    searchValue,
    suggestions = [],
    readOnly = true,
    onSearchChange,
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
    onCancelChanges,
    onShowProperties,
}: ToolbarProps) {
    const filterInputWrapperRef = useRef<HTMLDivElement>(null)
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0)

    const query = (searchValue || '').trim().toLowerCase()

    const filteredSuggestions = useMemo(() => {
        if (!query) return []
        return suggestions.slice(0, 8)
    }, [query, suggestions])

    useEffect(() => {
        if (!query) {
            setIsSuggestionsOpen(false)
            return
        }
        setIsSuggestionsOpen(true)
    }, [query])

    useEffect(() => {
        setHighlightedSuggestionIndex(0)
    }, [filteredSuggestions.length])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!filterInputWrapperRef.current) return
            const targetNode = event.target as Node | null
            if (targetNode && !filterInputWrapperRef.current.contains(targetNode)) {
                setIsSuggestionsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const applySuggestion = useCallback((suggestion: FilterSuggestion) => {
        if (!onSearchChange) return
        onSearchChange(suggestion.applyValue)
        setIsSuggestionsOpen(false)
    }, [onSearchChange])

    const renderHighlightedText = useCallback((text: string, textQuery: string) => {
        const normalizedQuery = textQuery.trim().toLowerCase()
        if (!normalizedQuery) return <>{text}</>

        const matchStart = text.toLowerCase().indexOf(normalizedQuery)
        if (matchStart === -1) return <>{text}</>

        const matchEnd = matchStart + normalizedQuery.length

        return (
            <>
                {text.slice(0, matchStart)}
                <mark className="filter-suggestion-match">{text.slice(matchStart, matchEnd)}</mark>
                {text.slice(matchEnd)}
            </>
        )
    }, [])

    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isSuggestionsOpen) {
            if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
                e.preventDefault()
                setIsSuggestionsOpen(true)
            }
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedSuggestionIndex((prev) =>
                filteredSuggestions.length === 0 ? 0 : (prev + 1) % filteredSuggestions.length
            )
            return
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedSuggestionIndex((prev) =>
                filteredSuggestions.length === 0
                    ? 0
                    : (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length
            )
            return
        }

        if (e.key === 'Enter' && filteredSuggestions.length > 0) {
            e.preventDefault()
            const selection = filteredSuggestions[highlightedSuggestionIndex]
            if (selection) {
                applySuggestion(selection)
            }
            return
        }

        if (e.key === 'Escape') {
            e.preventDefault()
            setIsSuggestionsOpen(false)
        }
    }, [applySuggestion, filteredSuggestions, highlightedSuggestionIndex, isSuggestionsOpen])

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

                {selectedCount > 0 && (
                    <div className="selection-info">
                        <FaCheck size={10} />
                        <span>{selectedCount} selected</span>
                        {onDeleteSelected && (
                            <button
                                className="delete-selected-btn"
                                onClick={onDeleteSelected}
                                title="Delete selected rows"
                            >
                                <FaTrash size={10} />
                            </button>
                        )}
                    </div>
                )}
                {/* Pending changes info */}
                {pendingChangesCount > 0 && (
                    <div className="pending-changes-info">
                        <span className="pending-badge">
                            {pendingChangesCount} unsaved change{pendingChangesCount > 1 ? 's' : ''}
                        </span>
                        <button
                            className="save-changes-btn"
                            onClick={onSaveChanges}
                            disabled={isSaving}
                            title="Save all changes"
                        >
                            {isSaving ? <FaSpinner className="spinning" size={12} /> : <FaCheck size={12} />}
                            <span style={{ marginLeft: 4 }}>Save</span>
                        </button>
                        <button
                            className="cancel-changes-btn"
                            onClick={onCancelChanges}
                            disabled={isSaving}
                            title="Cancel all changes"
                        >
                            <FaTimes size={12} />
                            <span style={{ marginLeft: 4 }}>Cancel</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Quick search filter */}
            {onSearchChange && (
                <div className="toolbar-center">
                    <div className="filter-input-container" ref={filterInputWrapperRef}>
                        <FaFilter size={11} className="filter-input-icon" />
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Quick filter..."
                            value={searchValue || ''}
                            onChange={(e) => {
                                const value = e.target.value
                                onSearchChange(value)
                                setIsSuggestionsOpen(value.trim().length > 0)
                            }}
                            onFocus={() => {
                                if ((searchValue || '').trim().length > 0) {
                                    setIsSuggestionsOpen(true)
                                }
                            }}
                            onKeyDown={handleSearchKeyDown}
                            aria-label="Quick filter"
                            aria-autocomplete="list"
                            aria-expanded={isSuggestionsOpen}
                        />
                        {searchValue && (
                            <button
                                className="filter-clear-btn"
                                onClick={() => {
                                    onSearchChange('')
                                    setIsSuggestionsOpen(false)
                                }}
                                title="Clear filter"
                            >
                                <FaTimes size={10} />
                            </button>
                        )}

                        {isSuggestionsOpen && (
                            <div className="filter-suggestions-dropdown" role="listbox" aria-label="Filter suggestions">
                                {filteredSuggestions.length === 0 ? (
                                    <div className="filter-suggestions-empty">No suggestions</div>
                                ) : (
                                    filteredSuggestions.map((suggestion, index) => (
                                        <button
                                            key={suggestion.id}
                                            className={`filter-suggestion-item ${index === highlightedSuggestionIndex ? 'active' : ''}`}
                                            type="button"
                                            role="option"
                                            aria-selected={index === highlightedSuggestionIndex}
                                            onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => applySuggestion(suggestion)}
                                        >
                                            <span className="filter-suggestion-label">
                                                {renderHighlightedText(suggestion.label, suggestion.matchQuery)}
                                            </span>
                                            <span className="filter-suggestion-kind">
                                                {SUGGESTION_KIND_LABEL[suggestion.kind]}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

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

                {onShowProperties && (
                    <>
                        <div className="toolbar-divider" />
                        <button
                            className="toolbar-properties-btn"
                            onClick={onShowProperties}
                            title="Table Properties"
                        >
                            Properties
                        </button>
                    </>
                )}

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
    onRowInsert,
    onRowDelete,
    onForeignKeyNavigate,
    canNavigateBack = false,
    onNavigateBack,
    onSaveSuccess,
    onSaveError,
    onShowProperties,
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
    const [quickFilter, setQuickFilter] = useState('')

    // Track pending changes
    const [pendingChanges, setPendingChanges] = useState<Record<string, { rowIndex: number; columnId: string; value: unknown; originalValue: unknown }>>({})
    const [isSaving, setIsSaving] = useState(false)

    // New row being added (shows at top of table)
    const [newRow, setNewRow] = useState<Record<string, unknown> | null>(null)
    const [newRowEditing, setNewRowEditing] = useState<string | null>(null)
    const [newRowEditValue, setNewRowEditValue] = useState('')

    // Tracks which row index to flash green after insertion
    const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)

    // Panel states
    const [showFilterPanel, setShowFilterPanel] = useState(false)
    const [showColumnsPanel, setShowColumnsPanel] = useState(false)
    const [showSortPanel, setShowSortPanel] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)
    const tableBodyRef = useRef<HTMLTableSectionElement>(null)
    const gridTableContainerRef = useRef<HTMLDivElement>(null)

    // Visible columns
    const visibleColumns = useMemo(() =>
        columns.filter(col => !hiddenColumns.includes(col.id)),
        [columns, hiddenColumns]
    )

    const quickFilterSuggestions = useMemo<FilterSuggestion[]>(() => {
        const parsed = parseQuickFilterInput(quickFilter)
        const seen = new Set<string>()
        const suggestions: FilterSuggestion[] = []

        const addSuggestion = (
            label: string,
            kind: FilterSuggestionKind,
            applyValue: string,
            matchQuery: string
        ) => {
            const trimmedLabel = label.trim()
            if (!trimmedLabel || !applyValue.trim()) return

            const key = `${kind}:${applyValue.trim().toLowerCase()}`
            if (seen.has(key)) return

            seen.add(key)
            suggestions.push({
                id: key,
                label: trimmedLabel,
                kind,
                applyValue,
                matchQuery,
            })
        }

        const matchingColumns = columns.filter((column) => {
            if (!parsed.normalizedColumnInput) return true
            return getColumnAliases(column).some((alias) => alias.includes(parsed.normalizedColumnInput))
        })

        if (!parsed.hasEquals) {
            for (const column of matchingColumns) {
                addSuggestion(column.name, 'COLUMN', `${column.name} = `, parsed.rawColumnInput)
            }
            return suggestions
        }

        const selectedColumn = resolveColumnFromInput(columns, parsed.normalizedColumnInput)

        if (!selectedColumn) {
            for (const column of matchingColumns) {
                addSuggestion(column.name, 'COLUMN', `${column.name} = `, parsed.rawColumnInput)
            }
            return suggestions
        }

        const selectedColumnId = selectedColumn.id
        const selectedColumnName = selectedColumn.name

        for (const filter of filters) {
            if (filter.column !== selectedColumnId && filter.column !== selectedColumnName) continue
            for (const value of filter.values) {
                const valueString = String(value)
                if (!valueString.toLowerCase().includes(parsed.normalizedValueInput)) continue
                addSuggestion(
                    valueString,
                    'RECENT',
                    `${selectedColumnName} = ${valueString}`,
                    parsed.valueInput
                )
            }
        }

        let valueCount = 0
        const maxValues = 120

        for (let rowIndex = 0; rowIndex < data.length && valueCount < maxValues; rowIndex += 1) {
            const row = data[rowIndex]
            const value = row[selectedColumnId]
            if (value === null || value === undefined) continue

            const valueString = String(value)
            if (valueString.length > 120) continue
            if (!valueString.toLowerCase().includes(parsed.normalizedValueInput)) continue

            addSuggestion(
                valueString,
                'VALUE',
                `${selectedColumnName} = ${valueString}`,
                parsed.valueInput
            )
            valueCount += 1
        }

        return suggestions
    }, [columns, data, filters, quickFilter])

    // Filter the data (client-side) using both quick filter and panel filters
    const filteredData = useMemo(() => {
        let result = data

        // Apply quick filter (search across all columns or column=value pattern)
        if (quickFilter.trim()) {
            const parsed = parseQuickFilterInput(quickFilter)
            const selectedColumn = resolveColumnFromInput(columns, parsed.normalizedColumnInput)

            if (parsed.hasEquals && selectedColumn && parsed.normalizedValueInput) {
                result = result.filter((row) => {
                    const cell = row[selectedColumn.id]
                    if (cell === null || cell === undefined) return false
                    return String(cell).toLowerCase().includes(parsed.normalizedValueInput)
                })
            } else {
                const searchLower = quickFilter.toLowerCase()
                result = result.filter((row) => {
                    return Object.values(row).some((cell) => {
                        if (cell === null || cell === undefined) return false
                        return String(cell).toLowerCase().includes(searchLower)
                    })
                })
            }
        }

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
    }, [columns, data, quickFilter, filters])

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

    // Cell editing - track changes instead of immediate save
    const handleCellDoubleClick = useCallback((rowIndex: number, colId: string, value: unknown) => {
        if (readOnly) return
        setEditingCell(`${rowIndex}-${colId}`)
        setEditValue(value === null || value === undefined ? '' : String(value))
    }, [readOnly])

    const handleCellBlur = useCallback(() => {
        if (!editingCell) return

        const [rowIndexStr, colId] = editingCell.split('-')
        const rowIndex = parseInt(rowIndexStr)
        const originalValue = data[rowIndex]?.[colId]
        const newValue = editValue

        // Check if value actually changed
        if (String(originalValue ?? '') !== String(newValue)) {
            // Add to pending changes
            setPendingChanges(prev => ({
                ...prev,
                [editingCell]: { rowIndex, columnId: colId, value: newValue, originalValue }
            }))
        }

        setEditingCell(null)
    }, [editingCell, editValue, data])

    const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellBlur()
        } else if (e.key === 'Escape') {
            setEditingCell(null)
        }
    }, [handleCellBlur])

    // Save all pending changes
    const handleSaveChanges = useCallback(async () => {
        if (Object.keys(pendingChanges).length === 0 || !onCellEdit) return

        setIsSaving(true)
        const changeCount = Object.keys(pendingChanges).length
        let successCount = 0
        let firstError: Error | null = null

        try {
            // Save each change
            for (const change of Object.values(pendingChanges)) {
                try {
                    await onCellEdit(change.rowIndex, change.columnId, change.value)
                    successCount++
                } catch (error) {
                    // Store first error but continue trying to save other changes
                    if (!firstError) {
                        firstError = error instanceof Error ? error : new Error('Failed to save change')
                    }
                    console.error('Failed to save change:', error)
                }
            }

            // Clear pending changes after save attempt
            setPendingChanges({})

            // Show appropriate message based on results
            if (firstError && successCount === 0) {
                // All failed
                if (onSaveError) {
                    onSaveError(firstError)
                }
                throw firstError
            } else if (firstError) {
                // Some failed - show partial success
                const partialError = new Error(`Saved ${successCount} of ${changeCount} changes. Some changes failed.`)
                if (onSaveError) {
                    onSaveError(partialError)
                }
                console.warn(partialError.message)
            } else {
                // All succeeded
                if (onSaveSuccess) {
                    onSaveSuccess(changeCount)
                }
            }
        } catch (error) {
            console.error('Failed to save changes:', error)
            // Keep pending changes on complete failure
            throw error
        } finally {
            setIsSaving(false)
        }
    }, [pendingChanges, onCellEdit, onSaveSuccess, onSaveError])

    // Cancel all pending changes
    const handleCancelChanges = useCallback(() => {
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
        if (!newRow) return

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
            if (onRowInsert) {
                await onRowInsert(rowToInsert)
                // Row is prepended at position 0 in the cache — scroll to top and flash it
                setNewRow(null)
                setNewRowEditing(null)
                setHighlightedRowIndex(0)
                const container = gridTableContainerRef.current
                if (container) {
                    container.scrollTo({ top: 0, behavior: 'smooth' })
                }
                setTimeout(() => setHighlightedRowIndex(null), 2500)
            } else {
                setNewRow(null)
                setNewRowEditing(null)
            }
        } catch (error) {
            console.error('Failed to add row:', error)
        }
    }, [columns, newRow, onRowInsert])

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
        const cellKey = `${rowIndex}-${colId}`
        const isEditing = editingCell === cellKey
        const isPending = cellKey in pendingChanges
        const column = columns.find(c => c.id === colId)
        const isForeignKey = column?.isForeignKey && column?.foreignTable

        // Get the display value (pending value if exists, otherwise original)
        const displayValue = isPending ? pendingChanges[cellKey].value : value

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
                    <span className={`fk-value ${isPending ? 'edited-cell' : ''}`}>{String(displayValue)}</span>
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

        return <span className={isPending ? 'edited-cell' : ''}>{String(displayValue)}</span>
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
                    canNavigateBack={canNavigateBack}
                    onNavigateBack={onNavigateBack}
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
                searchValue={quickFilter}
                suggestions={quickFilterSuggestions}
                readOnly={readOnly}
                onSearchChange={setQuickFilter}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                onRefresh={onRefresh}
                onExportCSV={handleExportCSV}
                onOpenFilters={() => setShowFilterPanel(true)}
                onOpenColumns={() => setShowColumnsPanel(true)}
                onOpenSort={() => setShowSortPanel(true)}
                onDeleteSelected={selectedRows.size > 0 && onRowDelete
                    ? () => onRowDelete(Array.from(selectedRows).map(i => filteredData[i]))
                    : undefined
                }
                onAddRow={handleAddRow}
                canNavigateBack={canNavigateBack}
                onNavigateBack={onNavigateBack}
                pendingChangesCount={Object.keys(pendingChanges).length}
                isSaving={isSaving}
                onSaveChanges={handleSaveChanges}
                onCancelChanges={handleCancelChanges}
                onShowProperties={onShowProperties}
            />

            {/* Active Filters */}
            <ActiveFiltersBar
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearFilters}
            />

            {/* Table Container */}
            <div
                ref={gridTableContainerRef}
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
                                className={`grid-row ${selectedRows.has(rowIndex) ? 'selected' : ''} ${highlightedRowIndex === rowIndex ? 'inserted-row-highlight' : ''}`}
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
                                        className="grid-cell"
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
                        {quickFilter && filteredData.length !== data.length && ` of ${data.length}`}
                        {' '}rows
                        {isFetchingMore && (
                            <span className="loading-more">
                                <FaSpinner size={10} className="spinning" />
                                Loading more...
                            </span>
                        )}
                        {hasMore && !isFetchingMore && !quickFilter && ' (scroll for more)'}
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
        </div>
    )
}

export { DataGridNew as DataGrid }
