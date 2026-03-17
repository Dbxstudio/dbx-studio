import { useCallback, useEffect, useState } from 'react'

const DEFAULT_LIMIT = 8

function sanitizeQuery(query: string) {
    return query.trim()
}

function loadQueries(storageKey: string) {
    if (typeof window === 'undefined') {
        return [] as string[]
    }

    try {
        const rawValue = window.localStorage.getItem(storageKey)

        if (!rawValue) {
            return [] as string[]
        }

        const parsedValue = JSON.parse(rawValue)

        if (!Array.isArray(parsedValue)) {
            return [] as string[]
        }

        return parsedValue
            .filter((value): value is string => typeof value === 'string')
            .map(sanitizeQuery)
            .filter(Boolean)
    } catch {
        return [] as string[]
    }
}

interface UseRecentQueriesOptions {
    storageKey?: string
    limit?: number
}

export function useRecentQueries(options: UseRecentQueriesOptions = {}) {
    const {
        storageKey = 'dbxstudio_recent_queries',
        limit = DEFAULT_LIMIT,
    } = options

    const [recentQueries, setRecentQueries] = useState<string[]>(() => loadQueries(storageKey))

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        window.localStorage.setItem(storageKey, JSON.stringify(recentQueries))
    }, [recentQueries, storageKey])

    const addRecentQuery = useCallback((query: string) => {
        const normalizedQuery = sanitizeQuery(query)

        if (!normalizedQuery) {
            return
        }

        setRecentQueries((currentQueries) => {
            return [
                normalizedQuery,
                ...currentQueries.filter((currentQuery) => currentQuery !== normalizedQuery),
            ].slice(0, limit)
        })
    }, [limit])

    return {
        recentQueries,
        addRecentQuery,
    }
}