import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
    FaExpand,
    FaCompress,
    FaTimes,
    FaSave,
    FaUndo,
    FaDatabase,
    FaSortUp,
    FaSortDown,
    FaSort,
    FaPlus,
    FaTrash,
    FaFileExport,
    FaSpinner,
    FaSync,
    FaTable,
    FaSearch,
    FaFilter,
} from 'react-icons/fa'
import './data-grid.css'

interface Column {
    name: string
    type?: string
}

interface DataGridProps {
    columns: Column[]
    data: any[][]
    loading?: boolean
    onLoadMore?: () => void
    hasMore?: boolean
    isDarkTheme?: boolean
    tableName?: string
    onRefresh?: () => void
    onSave?: (changes: any) => void
    onExportCSV?: () => void
    readOnly?: boolean
}

export function DataGrid({
    columns = [],
    data = [],
    loading = false,
    onLoadMore,
    hasMore = false,
    tableName,
    onRefresh,
    onExportCSV,
    readOnly = true,
}: DataGridProps) {
    const [columnSizing, setColumnSizing] = useState<Record<string, number>>({})
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [editingCell, setEditingCell] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
    const [changedCells, setChangedCells] = useState<Set<string>>(new Set())
    const [resizingColumn, setResizingColumn] = useState<string | null>(null)
    const [filterValue, setFilterValue] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const tableBodyRef = useRef<HTMLTableSectionElement>(null)
    const startXRef = useRef<number>(0)
    const startWidthRef = useRef<number>(0)

    // Default column width
    const DEFAULT_COL_WIDTH = 150
    const ROW_NUMBER_WIDTH = 50

    // Transform data from array format to object format
    const tableData = useMemo(() => {
        return data.map((row, rowIndex) => {
            const obj: Record<string, any> = {}
            row.forEach((cell, cellIndex) => {
                obj[cellIndex.toString()] = cell
            })
            return obj
        })
    }, [data])

    // Filter data based on filter value
    const filteredData = useMemo(() => {
        if (!filterValue.trim()) return tableData
        const searchLower = filterValue.toLowerCase()
        return tableData.filter((row) => {
            return Object.values(row).some((cell) => {
                if (cell === null || cell === undefined) return false
                return String(cell).toLowerCase().includes(searchLower)
            })
        })
    }, [tableData, filterValue])

    // Handle sort
    const handleColumnSort = useCallback((columnName: string) => {
        if (sortColumn === columnName) {
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortColumn(null)
                setSortDirection(null)
            }
        } else {
            setSortColumn(columnName)
            setSortDirection('asc')
        }
    }, [sortColumn, sortDirection])

    // Handle cell double-click for editing
    const handleCellDoubleClick = useCallback((rowIndex: number, colIndex: number, value: any) => {
        if (readOnly) return
        setEditingCell(`${rowIndex}-${colIndex}`)
        setEditValue(value === null || value === undefined ? '' : String(value))
    }, [readOnly])

    // Handle cell blur (save edit)
    const handleCellBlur = useCallback(() => {
        if (editingCell) {
            const [rowIndex, colIndex] = editingCell.split('-').map(Number)
            setChangedCells(prev => new Set(prev).add(editingCell))
            setEditingCell(null)
        }
    }, [editingCell])

    // Handle cell key press
    const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            handleCellBlur()
        }
    }, [handleCellBlur])

    // Handle row click
    const handleRowClick = useCallback((rowIndex: number) => {
        setSelectedRowIndex(prev => prev === rowIndex ? null : rowIndex)
    }, [])

    // Column resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent, columnName: string) => {
        e.preventDefault()
        setResizingColumn(columnName)
        startXRef.current = e.clientX
        startWidthRef.current = columnSizing[columnName] || 150
    }, [columnSizing])

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (resizingColumn) {
            const diff = e.clientX - startXRef.current
            const newWidth = Math.max(80, startWidthRef.current + diff)
            setColumnSizing(prev => ({ ...prev, [resizingColumn]: newWidth }))
        }
    }, [resizingColumn])

    const handleResizeEnd = useCallback(() => {
        setResizingColumn(null)
    }, [])

    useEffect(() => {
        if (resizingColumn) {
            document.addEventListener('mousemove', handleResizeMove)
            document.addEventListener('mouseup', handleResizeEnd)
            return () => {
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [resizingColumn, handleResizeMove, handleResizeEnd])

    // Handle scroll for infinite loading
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!hasMore || loading || !onLoadMore) return

        const container = e.currentTarget
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight

        if (scrollBottom < 100) {
            onLoadMore()
        }
    }, [hasMore, loading, onLoadMore])

    // Export CSV
    const handleExportCSV = useCallback(() => {
        if (onExportCSV) {
            onExportCSV()
            return
        }

        // Default CSV export
        const headers = columns.map(c => c.name).join(',')
        const rows = data.map(row =>
            row.map(cell => {
                if (cell === null || cell === undefined) return ''
                const str = String(cell)
                // Escape quotes and wrap in quotes if contains comma
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
    }, [columns, data, tableName, onExportCSV])

    // Render cell value
    const renderCellValue = (value: any, rowIndex: number, colIndex: number) => {
        const cellKey = `${rowIndex}-${colIndex}`
        const isEditing = editingCell === cellKey

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

        if (value === null || value === undefined) {
            return <span className="null-value">NULL</span>
        }

        if (typeof value === 'object') {
            return <span>{JSON.stringify(value)}</span>
        }

        return <span>{String(value)}</span>
    }

    // Empty state
    if (!loading && data.length === 0) {
        return (
            <div className={`modern-data-grid ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
                <div className="grid-toolbar">
                    <div className="toolbar-left">
                        {tableName && (
                            <div className="row-count">
                                <FaTable size={12} />
                                <span className="badge">{tableName}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid-empty">
                    <FaDatabase className="grid-empty-icon" />
                    <div className="grid-empty-text">No Data</div>
                    <div className="grid-empty-subtext">This table is empty or the query returned no results.</div>
                </div>
            </div>
        )
    }

    return (
        <div className={`modern-data-grid ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
            {/* Toolbar */}
            <div className="grid-toolbar">
                <div className="toolbar-left">
                    {tableName && (
                        <div className="row-count">
                            <FaTable size={12} />
                            <span className="badge">{tableName}</span>
                            <span>{filteredData.length} rows</span>
                            {filterValue && <span className="filter-active">(filtered from {data.length})</span>}
                            {hasMore && !filterValue && <span className="more-indicator">(more available)</span>}
                        </div>
                    )}

                    {changedCells.size > 0 && (
                        <span className="changes-indicator">{changedCells.size} changes</span>
                    )}
                </div>

                <div className="toolbar-center">
                    <div className="filter-input-container">
                        <FaSearch size={12} className="filter-input-icon" />
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Filter rows..."
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                        />
                        {filterValue && (
                            <button
                                className="filter-clear-btn"
                                onClick={() => setFilterValue('')}
                                title="Clear filter"
                            >
                                <FaTimes size={10} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="toolbar-right">
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
                        onClick={handleExportCSV}
                        title="Export CSV"
                    >
                        <FaFileExport size={14} />
                    </button>

                    <button
                        className="toolbar-icon-btn"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div
                className="grid-table-container"
                onScroll={handleScroll}
            >
                <table className="grid-table">
                    {/* Colgroup for consistent column widths */}
                    <colgroup>
                        <col style={{ width: ROW_NUMBER_WIDTH, minWidth: ROW_NUMBER_WIDTH }} />
                        {columns.map((column) => (
                            <col
                                key={column.name}
                                style={{
                                    width: columnSizing[column.name] || DEFAULT_COL_WIDTH,
                                    minWidth: 80,
                                }}
                            />
                        ))}
                    </colgroup>

                    {/* Header */}
                    <thead className="grid-thead">
                        <tr className="grid-header-row">
                            {/* Row number header */}
                            <th className="grid-th row-number-header">
                                <div className="th-content">
                                    <span className="th-text">#</span>
                                </div>
                            </th>

                            {columns.map((column, colIndex) => (
                                <th
                                    key={column.name}
                                    className={`grid-th sortable ${sortColumn === column.name ? 'sorted' : ''}`}
                                >
                                    <div className="th-content">
                                        <div
                                            className="th-label"
                                            onClick={() => handleColumnSort(column.name)}
                                        >
                                            <span className="th-text">{column.name}</span>
                                            {sortColumn === column.name && (
                                                <span className="sort-indicator-small">
                                                    {sortDirection === 'asc' ? (
                                                        <FaSortUp size={10} className="sort-icon-small" />
                                                    ) : (
                                                        <FaSortDown size={10} className="sort-icon-small" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`column-resizer ${resizingColumn === column.name ? 'resizing' : ''}`}
                                            onMouseDown={(e) => handleResizeStart(e, column.name)}
                                        />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="grid-tbody" ref={tableBodyRef}>
                        {filteredData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`grid-row ${selectedRowIndex === rowIndex ? 'selected' : ''}`}
                                onClick={() => handleRowClick(rowIndex)}
                            >
                                {/* Row number cell */}
                                <td className="grid-cell row-number-cell">
                                    {rowIndex + 1}
                                </td>

                                {columns.map((column, colIndex) => {
                                    const cellKey = `${rowIndex}-${colIndex}`
                                    const value = row[colIndex.toString()]
                                    const isChanged = changedCells.has(cellKey)

                                    return (
                                        <td
                                            key={colIndex}
                                            className={`grid-cell ${isChanged ? 'changed' : ''}`}
                                            onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex, value)}
                                        >
                                            <div className="cell-content-wrapper">
                                                {renderCellValue(value, rowIndex, colIndex)}
                                            </div>
                                        </td>
                                    )
                                })}
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
                        Showing {filteredData.length} {filterValue ? `of ${data.length} ` : ''}rows
                        {hasMore && !filterValue && ' (scroll for more)'}
                    </div>

                    {hasMore && onLoadMore && (
                        <button
                            className="load-more-btn"
                            onClick={onLoadMore}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <FaSpinner size={12} className="spinning" />
                                    <span>Loading...</span>
                                </>
                            ) : (
                                <>
                                    <FaPlus size={12} />
                                    <span>Load More</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
