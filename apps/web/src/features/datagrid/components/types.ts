// DataGrid types and interfaces

export interface Column {
    id: string
    name: string
    type?: string
    isPrimaryKey?: boolean
    isNullable?: boolean
    isUnique?: boolean
    isForeignKey?: boolean
    foreignSchema?: string | null
    foreignTable?: string | null
    foreignColumn?: string | null
    isEditable?: boolean
    isArray?: boolean
    defaultValue?: string | null
}

export interface ColumnRenderer {
    id: string
    size: number
    cell?: React.ComponentType<TableCellProps>
    header?: React.ComponentType<TableHeaderCellProps>
}

export interface TableCellProps {
    style: React.CSSProperties
    rowIndex: number
    columnIndex: number
    value: unknown
    position: 'first' | 'last' | 'middle'
    size: number
    id: string
}

export interface TableHeaderCellProps {
    style: React.CSSProperties
    columnIndex: number
    position: 'first' | 'last' | 'middle'
    size: number
    id: string
}

export type FilterOperator =
    | '='
    | '!='
    | '>'
    | '>='
    | '<'
    | '<='
    | 'LIKE'
    | 'NOT LIKE'
    | 'ILIKE'
    | 'NOT ILIKE'
    | 'IN'
    | 'NOT IN'
    | 'IS NULL'
    | 'IS NOT NULL'
    | 'BETWEEN'

export interface Filter {
    operator: FilterOperator
    label: string
    hasValue?: boolean
    isArray?: boolean
    group: 'comparison' | 'text' | 'list' | 'null' | 'range'
}

export interface ActiveFilter {
    column: string
    ref: Filter
    values: string[]
}

export type SortDirection = 'ASC' | 'DESC'

export interface SortOrder {
    [columnId: string]: SortDirection
}

export interface DataGridState {
    filters: ActiveFilter[]
    orderBy: SortOrder
    hiddenColumns: string[]
    selected: Record<string, unknown>[]
    isLoading: boolean
    error: string | null
}

export interface DataGridProps {
    columns: Column[]
    data: Record<string, unknown>[]
    tableName?: string
    schema?: string
    loading?: boolean
    error?: string | null
    readOnly?: boolean
    // Pagination
    hasMore?: boolean
    onLoadMore?: () => void
    isFetchingMore?: boolean
    totalCount?: number
    // Callbacks
    onRefresh?: () => void
    onExportCSV?: () => void
    onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => Promise<void>
    onRowDelete?: (rows: Record<string, unknown>[]) => Promise<void>
    onForeignKeyNavigate?: (table: string, schema: string, column: string, value: unknown) => void
    // Navigation (for FK drill-down)
    canNavigateBack?: boolean
    onNavigateBack?: () => void
    // Filter/Sort callbacks for server-side operations
    onFilterChange?: (filters: ActiveFilter[]) => void
    onSortChange?: (orderBy: SortOrder) => void
    // Save callbacks for user feedback
    onSaveSuccess?: (changeCount: number) => void
    onSaveError?: (error: Error) => void
}

// Filter definitions
export const SQL_FILTERS: Filter[] = [
    // Comparison
    { operator: '=', label: 'Equals', group: 'comparison' },
    { operator: '!=', label: 'Not equals', group: 'comparison' },
    { operator: '>', label: 'Greater than', group: 'comparison' },
    { operator: '>=', label: 'Greater or equal', group: 'comparison' },
    { operator: '<', label: 'Less than', group: 'comparison' },
    { operator: '<=', label: 'Less or equal', group: 'comparison' },
    // Text
    { operator: 'LIKE', label: 'Like (case-sensitive)', group: 'text' },
    { operator: 'NOT LIKE', label: 'Not like (case-sensitive)', group: 'text' },
    { operator: 'ILIKE', label: 'Like (case-insensitive)', group: 'text' },
    { operator: 'NOT ILIKE', label: 'Not like (case-insensitive)', group: 'text' },
    // List
    { operator: 'IN', label: 'In list', isArray: true, group: 'list' },
    { operator: 'NOT IN', label: 'Not in list', isArray: true, group: 'list' },
    // Null
    { operator: 'IS NULL', label: 'Is null', hasValue: false, group: 'null' },
    { operator: 'IS NOT NULL', label: 'Is not null', hasValue: false, group: 'null' },
    // Range
    { operator: 'BETWEEN', label: 'Between', isArray: true, group: 'range' },
]

export const FILTER_GROUPS: Record<string, string> = {
    comparison: 'Comparison',
    text: 'Text Search',
    list: 'List Operations',
    null: 'Null Checks',
    range: 'Range',
}

// Helper to get column size based on type
export function getColumnSize(type?: string): number {
    if (!type) return 150

    const typeLower = type.toLowerCase()

    if (typeLower.includes('uuid')) return 280
    if (typeLower.includes('timestamp') || typeLower.includes('datetime')) return 200
    if (typeLower.includes('date')) return 120
    if (typeLower.includes('time')) return 100
    if (typeLower.includes('int') || typeLower.includes('numeric') || typeLower.includes('decimal')) return 100
    if (typeLower.includes('bool')) return 80
    if (typeLower.includes('text') || typeLower.includes('varchar')) return 200
    if (typeLower.includes('json') || typeLower.includes('jsonb')) return 250

    return 150
}
