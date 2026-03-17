import { useState } from 'react'
import type { ColumnInfo } from '~/shared/hooks'
import './table-properties.css'

interface TablePropertiesProps {
    tableName: string
    schema: string
    databaseName?: string
    columns: ColumnInfo[]
    loading?: boolean
    onRefresh?: () => void
    onBackToData?: () => void
}

type SidebarSection = 'columns' | 'keys' | 'foreign-keys' | 'indexes' | 'semantic'

export function TableProperties({
    tableName,
    schema,
    databaseName,
    columns,
    loading = false,
    onRefresh,
    onBackToData,
}: TablePropertiesProps) {
    const [activeSection, setActiveSection] = useState<SidebarSection>('columns')

    const primaryKeys = columns.filter(c => c.isPrimaryKey)
    const foreignKeys = columns.filter(c => c.isForeignKey)
    const indexedColumns = columns.filter(c => c.indexName)
    const uniqueIndexNames = [...new Set(indexedColumns.map(c => c.indexName))]

    const today = new Date().toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
    })

    const getKeyLabel = (col: ColumnInfo) => {
        if (col.isPrimaryKey) return 'PK'
        if (col.isForeignKey) return 'FK'
        if (col.isUnique) return 'UQ'
        return '-'
    }

    const getExtraLabel = (col: ColumnInfo) => {
        if (col.defaultValue?.startsWith('nextval(')) return 'auto_increment'
        return '-'
    }

    return (
        <div className="table-properties">
            {/* Header */}
            <div className="tp-header">
                <div className="tp-header-left">
                    <svg className="tp-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="5" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="tp-table-name">{tableName}</span>
                    <span className="tp-schema-badge">{schema}</span>
                </div>
                <div className="tp-header-right">
                    {databaseName && (
                        <span className="tp-db-name">
                            <svg className="tp-icon-sm" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <ellipse cx="8" cy="4" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.3" />
                                <path d="M2 4v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V4" stroke="currentColor" strokeWidth="1.3" />
                                <path d="M2 8v4c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" stroke="currentColor" strokeWidth="1.3" />
                            </svg>
                            {databaseName}
                        </span>
                    )}
                    <span className="tp-date">
                        <svg className="tp-icon-sm" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        {today}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="tp-toolbar">
                {onBackToData && (
                    <button className="tp-back-btn" onClick={onBackToData}>
                        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12">
                            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Data
                    </button>
                )}
                <span className="tp-toolbar-title">Properties</span>
                <button className="tp-refresh-btn" onClick={onRefresh} title="Refresh">
                    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="13">
                        <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2L14 3v4h-4l1.6-1.6A4 4 0 1 0 12 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Body */}
            <div className="tp-body">
                {/* Sidebar */}
                <nav className="tp-sidebar">
                    <button
                        className={`tp-nav-item ${activeSection === 'columns' ? 'active' : ''}`}
                        onClick={() => setActiveSection('columns')}
                    >
                        <svg className="tp-nav-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="1" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.3" />
                            <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.3" />
                            <line x1="5" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                        Columns
                    </button>
                    <button
                        className={`tp-nav-item ${activeSection === 'keys' ? 'active' : ''}`}
                        onClick={() => setActiveSection('keys')}
                    >
                        <svg className="tp-nav-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="6" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8.5 7.5l5 -3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <path d="M12 5.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <path d="M10 6.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        Keys
                    </button>
                    <button
                        className={`tp-nav-item ${activeSection === 'foreign-keys' ? 'active' : ''}`}
                        onClick={() => setActiveSection('foreign-keys')}
                    >
                        <svg className="tp-nav-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="4" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                            <circle cx="12" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        Foreign Keys
                    </button>
                    <button
                        className={`tp-nav-item ${activeSection === 'indexes' ? 'active' : ''}`}
                        onClick={() => setActiveSection('indexes')}
                    >
                        <svg className="tp-nav-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            <line x1="2" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        Indexes
                    </button>
                    <button
                        className={`tp-nav-item ${activeSection === 'semantic' ? 'active' : ''}`}
                        onClick={() => setActiveSection('semantic')}
                    >
                        <svg className="tp-nav-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 2l1.5 4h4l-3.2 2.4 1.2 4L8 10l-3.5 2.4 1.2-4L2.5 6h4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                        Semantic Columns
                    </button>
                </nav>

                {/* Content area */}
                <div className="tp-content">
                    {loading ? (
                        <div className="tp-empty-state">Loading properties…</div>
                    ) : activeSection === 'columns' ? (
                        <table className="tp-table">
                            <thead>
                                <tr>
                                    <th className="tp-th-num">#</th>
                                    <th>COLUMN NAME</th>
                                    <th>DATA TYPE</th>
                                    <th>NULLABLE</th>
                                    <th>DEFAULT</th>
                                    <th>KEY</th>
                                    <th>EXTRA</th>
                                    <th>INDEX</th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns.map((col, idx) => (
                                    <tr key={col.name}>
                                        <td className="tp-td-num">{idx + 1}</td>
                                        <td>
                                            <span className="tp-col-name">{col.name}</span>
                                            {col.isPrimaryKey && (
                                                <svg className="tp-badge-icon tp-pk" viewBox="0 0 16 16" fill="none" aria-label="Primary Key">
                                                    <circle cx="6" cy="9" r="3" stroke="currentColor" strokeWidth="1.3" />
                                                    <path d="M8.2 7.5L13 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                                    <path d="M11.5 5.2l1.3 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                                    <path d="M9.8 6l1.3 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                                </svg>
                                            )}
                                            {col.isForeignKey && (
                                                <svg className="tp-badge-icon tp-fk" viewBox="0 0 16 16" fill="none" aria-label="Foreign Key">
                                                    <circle cx="4" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                                                    <circle cx="12" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
                                                    <path d="M6.2 8h3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                                </svg>
                                            )}
                                        </td>
                                        <td className="tp-td-type">{col.type}</td>
                                        <td className="tp-td-nullable">
                                            {col.nullable
                                                ? <span className="tp-check tp-check-yes">✓</span>
                                                : <span className="tp-check tp-check-no" />
                                            }
                                        </td>
                                        <td className="tp-td-default">
                                            {col.defaultValue
                                                ? <span className="tp-default-val">{col.defaultValue}</span>
                                                : <span className="tp-null-val">NULL</span>
                                            }
                                        </td>
                                        <td className="tp-td-key">{getKeyLabel(col)}</td>
                                        <td className="tp-td-extra">
                                            <em>{getExtraLabel(col)}</em>
                                        </td>
                                        <td className="tp-td-index">{col.indexName || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : activeSection === 'keys' ? (
                        <table className="tp-table">
                            <thead>
                                <tr>
                                    <th>CONSTRAINT NAME</th>
                                    <th>COLUMN</th>
                                    <th>TYPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {primaryKeys.length === 0 ? (
                                    <tr><td colSpan={3} className="tp-empty-row">No primary keys defined</td></tr>
                                ) : (
                                    primaryKeys.map(col => (
                                        <tr key={col.name}>
                                            <td>{col.indexName || `${tableName}_pkey`}</td>
                                            <td>{col.name}</td>
                                            <td>PRIMARY KEY</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : activeSection === 'foreign-keys' ? (
                        <table className="tp-table">
                            <thead>
                                <tr>
                                    <th>COLUMN</th>
                                    <th>REFERENCES COLUMN</th>
                                    <th>REFERENCES TABLE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {foreignKeys.length === 0 ? (
                                    <tr><td colSpan={3} className="tp-empty-row">No foreign keys defined</td></tr>
                                ) : (
                                    foreignKeys.map(col => (
                                        <tr key={col.name}>
                                            <td>{col.name}</td>
                                            <td>{col.foreignColumn || '-'}</td>
                                            <td>{[col.foreignSchema, col.foreignTable].filter(Boolean).join('.')}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : activeSection === 'indexes' ? (
                        <table className="tp-table">
                            <thead>
                                <tr>
                                    <th>INDEX NAME</th>
                                    <th>COLUMN</th>
                                    <th>TYPE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uniqueIndexNames.length === 0 ? (
                                    <tr><td colSpan={3} className="tp-empty-row">No indexes found</td></tr>
                                ) : (
                                    indexedColumns.map(col => (
                                        <tr key={col.name}>
                                            <td>{col.indexName}</td>
                                            <td>{col.name}</td>
                                            <td>{col.isPrimaryKey ? 'PRIMARY' : col.isUnique ? 'UNIQUE' : 'INDEX'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="tp-empty-state">
                            Semantic column annotations are not yet available.
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="tp-footer">
                <span>Total Columns: <strong>{columns.length}</strong></span>
                <span className="tp-sep">•</span>
                <span>Primary Keys: <strong>{primaryKeys.length}</strong></span>
                <span className="tp-sep">•</span>
                <span>Foreign Keys: <strong>{foreignKeys.length}</strong></span>
                <span className="tp-sep">•</span>
                <span>Indexes: <strong>{uniqueIndexNames.length}</strong></span>
            </div>
        </div>
    )
}
