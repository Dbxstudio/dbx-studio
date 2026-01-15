import { createContext, useContext, useRef, useState, useCallback, useMemo, type ReactNode, useEffect } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import type { Column, ActiveFilter, SortOrder, ColumnRenderer } from './types'
import { getColumnSize } from './types'

// Default sizes
export const DEFAULT_ROW_HEIGHT = 36
export const DEFAULT_COLUMN_WIDTH = 150

interface DataGridContextType {
    // Scroll
    scrollRef: React.RefObject<HTMLDivElement | null>
    // Rows and columns
    rows: Record<string, unknown>[]
    columns: ColumnRenderer[]
    rawColumns: Column[]
    // Virtual items
    virtualRows: VirtualItem[]
    virtualColumns: VirtualItem[]
    tableHeight: number
    tableWidth: number
    // State
    filters: ActiveFilter[]
    orderBy: SortOrder
    hiddenColumns: string[]
    selected: Record<string, unknown>[]
    // Actions
    setFilters: (filters: ActiveFilter[]) => void
    addFilter: (filter: ActiveFilter) => void
    removeFilter: (index: number) => void
    updateFilter: (index: number, filter: ActiveFilter) => void
    setOrderBy: (orderBy: SortOrder) => void
    toggleSort: (columnId: string) => void
    setHiddenColumns: (columns: string[]) => void
    toggleColumnVisibility: (columnId: string) => void
    setSelected: (selected: Record<string, unknown>[]) => void
    toggleRowSelection: (row: Record<string, unknown>, primaryKeys: string[]) => void
    toggleAllSelection: (primaryKeys: string[]) => void
    clearSelection: () => void
    // Loading state
    isLoading: boolean
    error: string | null
}

const DataGridContext = createContext<DataGridContextType | null>(null)

export function useDataGridContext() {
    const context = useContext(DataGridContext)
    if (!context) {
        throw new Error('useDataGridContext must be used within a DataGridProvider')
    }
    return context
}

interface DataGridProviderProps {
    children: ReactNode
    rows: Record<string, unknown>[]
    columns: Column[]
    columnRenderers?: ColumnRenderer[]
    estimatedRowSize?: number
    estimatedColumnSize?: number
    initialFilters?: ActiveFilter[]
    initialOrderBy?: SortOrder
    initialHiddenColumns?: string[]
    isLoading?: boolean
    error?: string | null
    onFilterChange?: (filters: ActiveFilter[]) => void
    onSortChange?: (orderBy: SortOrder) => void
}

export function DataGridProvider({
    children,
    rows,
    columns,
    columnRenderers,
    estimatedRowSize = DEFAULT_ROW_HEIGHT,
    estimatedColumnSize = DEFAULT_COLUMN_WIDTH,
    initialFilters = [],
    initialOrderBy = {},
    initialHiddenColumns = [],
    isLoading = false,
    error = null,
    onFilterChange,
    onSortChange,
}: DataGridProviderProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)

    // State
    const [filters, setFiltersState] = useState<ActiveFilter[]>(initialFilters)
    const [orderBy, setOrderByState] = useState<SortOrder>(initialOrderBy)
    const [hiddenColumns, setHiddenColumns] = useState<string[]>(initialHiddenColumns)
    const [selected, setSelected] = useState<Record<string, unknown>[]>([])

    // Build column renderers from raw columns if not provided
    const effectiveColumns = useMemo(() => {
        if (columnRenderers) return columnRenderers

        return columns
            .filter(col => !hiddenColumns.includes(col.id))
            .map(col => ({
                id: col.id,
                size: getColumnSize(col.type),
            }))
    }, [columns, columnRenderers, hiddenColumns])

    // Virtual row setup
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => estimatedRowSize,
        overscan: 10,
    })

    // Virtual column setup
    const columnVirtualizer = useVirtualizer({
        horizontal: true,
        count: effectiveColumns.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index: number) => effectiveColumns[index]?.size ?? estimatedColumnSize,
        overscan: 3,
    })

    const virtualRows = rowVirtualizer.getVirtualItems()
    const virtualColumns = columnVirtualizer.getVirtualItems()
    const tableHeight = rowVirtualizer.getTotalSize()
    const tableWidth = columnVirtualizer.getTotalSize()

    // Update CSS custom properties for virtual scroll offsets
    useEffect(() => {
        if (scrollRef.current) {
            const leftOffset = virtualColumns[0]?.start ?? 0
            const rightOffset = tableWidth - (virtualColumns[virtualColumns.length - 1]?.end ?? 0)
            const topOffset = virtualRows[0]?.start ?? 0
            const bottomOffset = tableHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0)

            scrollRef.current.style.setProperty('--table-scroll-left-offset', `${leftOffset}px`)
            scrollRef.current.style.setProperty('--table-scroll-right-offset', `${rightOffset}px`)
            scrollRef.current.style.setProperty('--table-scroll-top-offset', `${topOffset}px`)
            scrollRef.current.style.setProperty('--table-scroll-bottom-offset', `${bottomOffset}px`)
        }
    }, [virtualColumns, virtualRows, tableWidth, tableHeight])

    // Filter actions
    const setFilters = useCallback((newFilters: ActiveFilter[]) => {
        setFiltersState(newFilters)
        onFilterChange?.(newFilters)
    }, [onFilterChange])

    const addFilter = useCallback((filter: ActiveFilter) => {
        setFilters([...filters, filter])
    }, [filters, setFilters])

    const removeFilter = useCallback((index: number) => {
        setFilters(filters.filter((_, i) => i !== index))
    }, [filters, setFilters])

    const updateFilter = useCallback((index: number, filter: ActiveFilter) => {
        const newFilters = [...filters]
        newFilters[index] = filter
        setFilters(newFilters)
    }, [filters, setFilters])

    // Sort actions
    const setOrderBy = useCallback((newOrderBy: SortOrder) => {
        setOrderByState(newOrderBy)
        onSortChange?.(newOrderBy)
    }, [onSortChange])

    const toggleSort = useCallback((columnId: string) => {
        const currentOrder = orderBy[columnId]
        let newOrderBy: SortOrder

        if (!currentOrder) {
            newOrderBy = { ...orderBy, [columnId]: 'ASC' }
        } else if (currentOrder === 'ASC') {
            newOrderBy = { ...orderBy, [columnId]: 'DESC' }
        } else {
            const { [columnId]: _, ...rest } = orderBy
            newOrderBy = rest
        }

        setOrderBy(newOrderBy)
    }, [orderBy, setOrderBy])

    // Column visibility
    const toggleColumnVisibility = useCallback((columnId: string) => {
        if (hiddenColumns.includes(columnId)) {
            setHiddenColumns(hiddenColumns.filter(id => id !== columnId))
        } else {
            setHiddenColumns([...hiddenColumns, columnId])
        }
    }, [hiddenColumns])

    // Row selection
    const toggleRowSelection = useCallback((row: Record<string, unknown>, primaryKeys: string[]) => {
        const isSelected = selected.some(selectedRow =>
            primaryKeys.every(key => selectedRow[key] === row[key])
        )

        if (isSelected) {
            setSelected(selected.filter(selectedRow =>
                !primaryKeys.every(key => selectedRow[key] === row[key])
            ))
        } else {
            setSelected([...selected, row])
        }
    }, [selected])

    const toggleAllSelection = useCallback((primaryKeys: string[]) => {
        if (selected.length === rows.length) {
            setSelected([])
        } else {
            setSelected([...rows])
        }
    }, [selected, rows])

    const clearSelection = useCallback(() => {
        setSelected([])
    }, [])

    const value = useMemo(() => ({
        scrollRef,
        rows,
        columns: effectiveColumns,
        rawColumns: columns,
        virtualRows,
        virtualColumns,
        tableHeight,
        tableWidth,
        filters,
        orderBy,
        hiddenColumns,
        selected,
        setFilters,
        addFilter,
        removeFilter,
        updateFilter,
        setOrderBy,
        toggleSort,
        setHiddenColumns,
        toggleColumnVisibility,
        setSelected,
        toggleRowSelection,
        toggleAllSelection,
        clearSelection,
        isLoading,
        error,
    }), [
        rows,
        columns,
        effectiveColumns,
        virtualRows,
        virtualColumns,
        tableHeight,
        tableWidth,
        filters,
        orderBy,
        hiddenColumns,
        selected,
        setFilters,
        addFilter,
        removeFilter,
        updateFilter,
        setOrderBy,
        toggleSort,
        toggleColumnVisibility,
        toggleRowSelection,
        toggleAllSelection,
        clearSelection,
        isLoading,
        error,
    ])

    return (
        <DataGridContext.Provider value={value}>
            {children}
        </DataGridContext.Provider>
    )
}
