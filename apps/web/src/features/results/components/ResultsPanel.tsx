import { useState, useMemo, useCallback } from 'react'
import { FaTable, FaCode, FaCopy, FaFileExport, FaSpinner, FaExclamationTriangle, FaCheckCircle, FaTimes } from 'react-icons/fa'
import { DataGrid } from '../../datagrid'
import './results-panel.css'

interface Column {
    name: string
    type?: string
}

interface ResultsPanelProps {
    columns: Column[]
    rows: any[][]
    loading?: boolean
    error?: string | null
    executionTime?: number
    onClose?: () => void
    onLoadMore?: () => void
    hasMore?: boolean
}

export function ResultsPanel({
    columns = [],
    rows = [],
    loading = false,
    error = null,
    executionTime,
    onClose,
    onLoadMore,
    hasMore = false,
}: ResultsPanelProps) {
    const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
    const [copySuccess, setCopySuccess] = useState(false)

    // Convert rows to JSON format for display
    const jsonData = useMemo(() => {
        return rows.map(row => {
            const obj: Record<string, any> = {}
            columns.forEach((col, idx) => {
                obj[col.name] = row[idx]
            })
            return obj
        })
    }, [columns, rows])

    // Copy JSON to clipboard
    const handleCopyJSON = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2))
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
    }, [jsonData])

    // Export CSV
    const handleExportCSV = useCallback(() => {
        const headers = columns.map(c => c.name).join(',')
        const csvRows = rows.map(row =>
            row.map(cell => {
                if (cell === null || cell === undefined) return ''
                const str = String(cell)
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`
                }
                return str
            }).join(',')
        ).join('\n')

        const csv = `${headers}\n${csvRows}`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `query_results.csv`
        a.click()
        URL.revokeObjectURL(url)
    }, [columns, rows])

    // Loading state
    if (loading) {
        return (
            <div className="results-panel">
                <div className="results-loading">
                    <FaSpinner size={24} className="spinning" />
                    <span>Executing query...</span>
                </div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="results-panel">
                <div className="results-error">
                    <FaExclamationTriangle size={20} />
                    <div className="error-content">
                        <strong>Query Error</strong>
                        <span>{error}</span>
                    </div>
                    {onClose && (
                        <button className="close-btn" onClick={onClose}>
                            <FaTimes size={14} />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Empty state
    if (columns.length === 0 && rows.length === 0) {
        return (
            <div className="results-panel">
                <div className="results-empty">
                    <FaTable size={32} />
                    <span>Run a query to see results</span>
                </div>
            </div>
        )
    }

    return (
        <div className="results-panel">
            {/* Toolbar */}
            <div className="results-toolbar">
                <div className="toolbar-left">
                    {/* View Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table View"
                        >
                            <FaTable size={12} />
                            <span>Table</span>
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'json' ? 'active' : ''}`}
                            onClick={() => setViewMode('json')}
                            title="JSON View"
                        >
                            <FaCode size={12} />
                            <span>JSON</span>
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="results-stats">
                        <span className="stat-item">
                            <strong>{rows.length}</strong> rows
                        </span>
                        {executionTime !== undefined && (
                            <span className="stat-item">
                                <strong>{executionTime.toFixed(0)}</strong> ms
                            </span>
                        )}
                    </div>
                </div>

                <div className="toolbar-right">
                    {/* Copy JSON */}
                    <button
                        className="toolbar-btn"
                        onClick={handleCopyJSON}
                        title="Copy as JSON"
                    >
                        {copySuccess ? (
                            <>
                                <FaCheckCircle size={12} />
                                <span>Copied!</span>
                            </>
                        ) : (
                            <>
                                <FaCopy size={12} />
                                <span>Copy</span>
                            </>
                        )}
                    </button>

                    {/* Export CSV */}
                    <button
                        className="toolbar-btn"
                        onClick={handleExportCSV}
                        title="Export as CSV"
                    >
                        <FaFileExport size={12} />
                        <span>Export</span>
                    </button>

                    {/* Close */}
                    {onClose && (
                        <button className="toolbar-btn close-btn" onClick={onClose}>
                            <FaTimes size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="results-content">
                {viewMode === 'table' ? (
                    <DataGrid
                        columns={columns.map(c => ({
                            id: c.name,
                            name: c.name,
                            type: c.type,
                        }))}
                        data={rows.map(row => {
                            const obj: Record<string, unknown> = {}
                            columns.forEach((col, idx) => {
                                obj[col.name] = row[idx]
                            })
                            return obj
                        })}
                        loading={loading}
                        onLoadMore={onLoadMore}
                        hasMore={hasMore}
                        readOnly={true}
                    />
                ) : (
                    <div className="json-view">
                        <pre>{JSON.stringify(jsonData, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    )
}
