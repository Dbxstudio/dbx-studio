import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../services/api'

// Types
export interface TableInfo {
    name: string
    type: 'table' | 'view'
}

export interface ColumnInfo {
    name: string
    type: string
    nullable: boolean
    defaultValue: string | null
    isPrimaryKey: boolean
    isUnique: boolean
    isForeignKey?: boolean
    foreignSchema?: string | null
    foreignTable?: string | null
    foreignColumn?: string | null
}

export interface TableData {
    rows: Record<string, unknown>[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// Query Keys
export const tableKeys = {
    all: ['tables'] as const,
    list: (connectionId: string, schema?: string) =>
        [...tableKeys.all, 'list', connectionId, schema] as const,
    columns: (connectionId: string, tableName: string, schema?: string) =>
        [...tableKeys.all, 'columns', connectionId, tableName, schema] as const,
    data: (connectionId: string, tableName: string, schema?: string, page?: number) =>
        [...tableKeys.all, 'data', connectionId, tableName, schema, page] as const,
}

// Helper to extract data from oRPC response
function extractData<T>(result: any): T {
    // oRPC with superjson returns { json: data, meta: [...] }
    if (result && typeof result === 'object' && 'json' in result) {
        return result.json as T
    }
    return result as T
}

/**
 * Get list of tables in a connection
 */
export function useTables(connectionId: string, schema = 'public') {
    return useQuery({
        queryKey: tableKeys.list(connectionId, schema),
        queryFn: async () => {
            const result = await api.tables.list({ connectionId, schema })
            return extractData<TableInfo[]>(result)
        },
        enabled: !!connectionId,
    })
}

/**
 * Get columns for a table
 */
export function useTableColumns(connectionId: string, tableName: string, schema = 'public') {
    return useQuery({
        queryKey: tableKeys.columns(connectionId, tableName, schema),
        queryFn: async () => {
            const result = await api.tables.columns({ connectionId, tableName, schema })
            return extractData<ColumnInfo[]>(result)
        },
        enabled: !!connectionId && !!tableName,
    })
}

/**
 * Get table data with pagination
 */
export function useTableData(
    connectionId: string,
    tableName: string,
    schema = 'public',
    options: {
        page?: number
        pageSize?: number
        orderBy?: string
        orderDirection?: 'asc' | 'desc'
    } = {}
) {
    const { page = 1, pageSize = 50, orderBy, orderDirection } = options

    return useQuery({
        queryKey: tableKeys.data(connectionId, tableName, schema, page),
        queryFn: async () => {
            const result = await api.tables.data({
                connectionId,
                tableName,
                schema,
                page,
                pageSize,
                orderBy,
                orderDirection,
            })
            return extractData<TableData>(result)
        },
        enabled: !!connectionId && !!tableName,
    })
}

/**
 * Get table row count (fast, no data fetch)
 */
export function useTableCount(
    connectionId: string,
    tableName: string,
    schema = 'public'
) {
    return useQuery({
        queryKey: [...tableKeys.all, 'count', connectionId, tableName, schema],
        queryFn: async () => {
            const result = await api.tables.count({
                connectionId,
                tableName,
                schema,
            })
            return extractData<{ count: number }>(result)
        },
        enabled: !!connectionId && !!tableName,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })
}

/**
 * Prefetch table columns and data (for hover/preview)
 */
export function usePrefetchTableData() {
    const queryClient = useQueryClient()

    return useCallback((connectionId: string, tableName: string, schema = 'public') => {
        // Prefetch columns
        queryClient.prefetchQuery({
            queryKey: tableKeys.columns(connectionId, tableName, schema),
            queryFn: async () => {
                const result = await api.tables.columns({
                    connectionId,
                    tableName,
                    schema,
                })
                return extractData<ColumnInfo[]>(result)
            },
            staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        })

        // Prefetch first page of data (50 rows)
        queryClient.prefetchInfiniteQuery({
            queryKey: [...tableKeys.all, 'infinite', connectionId, tableName, schema, undefined, undefined],
            queryFn: async () => {
                const result = await api.tables.data({
                    connectionId,
                    tableName,
                    schema,
                    page: 1,
                    pageSize: 50,
                })
                return extractData<TableData>(result)
            },
            initialPageParam: 1,
            staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        })
    }, [queryClient])
}

/**
 * Get table data with infinite scroll pagination and server-side filtering
 */
export function useInfiniteTableData(
    connectionId: string,
    tableName: string,
    schema = 'public',
    options: {
        pageSize?: number
        orderBy?: string
        orderDirection?: 'asc' | 'desc'
        filters?: Array<{
            column: string
            operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'NOT LIKE' | 'ILIKE' | 'NOT ILIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN'
            values: unknown[]
        }>
    } = {}
) {
    const { pageSize = 50, orderBy, orderDirection, filters } = options

    return useInfiniteQuery({
        // Include filters in the query key so that changes to filters triggers a refetch
        queryKey: [...tableKeys.all, 'infinite', connectionId, tableName, schema, orderBy, orderDirection, JSON.stringify(filters)],
        queryFn: async ({ pageParam = 1 }) => {
            const result = await api.tables.data({
                connectionId,
                tableName,
                schema,
                page: pageParam,
                pageSize,
                orderBy,
                orderDirection,
                filters,
            })
            return extractData<TableData>(result)
        },
        getNextPageParam: (lastPage) => {
            // Return next page number if there are more pages
            if (lastPage.page < lastPage.totalPages) {
                return lastPage.page + 1
            }
            return undefined
        },
        initialPageParam: 1,
        enabled: !!connectionId && !!tableName,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
        refetchOnMount: true, // Refetch on mount to get fresh data
        refetchOnWindowFocus: false, // Don't refetch on window focus
    })
}

/**
 * Insert a row
 */
export function useInsertRow() {
    return useMutation({
        mutationFn: async (input: {
            connectionId: string
            tableName: string
            schema?: string
            data: Record<string, unknown>
        }) => {
            const result = await api.tables.insertRow(input)
            return extractData<any>(result)
        },
    })
}

/**
 * Update a row
 */
export function useUpdateRow() {
    return useMutation({
        mutationFn: async (input: {
            connectionId: string
            tableName: string
            schema?: string
            primaryKey: Record<string, unknown>
            data: Record<string, unknown>
        }) => {
            const result = await api.tables.updateRow(input)
            return extractData<any>(result)
        },
    })
}

/**
 * Delete a row
 */
export function useDeleteRow() {
    return useMutation({
        mutationFn: async (input: {
            connectionId: string
            tableName: string
            schema?: string
            primaryKey: Record<string, unknown>
        }) => {
            const result = await api.tables.deleteRow(input)
            return extractData<any>(result)
        },
    })
}
