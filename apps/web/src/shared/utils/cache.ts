/**
 * LocalStorage-based cache utility for persisting app state
 */

const CACHE_KEYS = {
    SELECTED_CONNECTION: 'dbx_selected_connection',
    ACTIVE_TAB: 'dbx_active_tab',
    OPEN_TABS: 'dbx_open_tabs',
    SCHEMA_TREE_STATE: 'dbx_schema_tree_state',
    QUERY_EDITOR_CONTENT: 'dbx_query_editor_content',
} as const

interface SchemaTreeState {
    expandedNodes: string[]
    selectedNode: string | null
}

interface TabState {
    id: string
    type: 'worksheet' | 'table'
    title: string
    connectionId?: string
    schema?: string
    tableName?: string
    sql?: string
}

// Generic cache get/set functions
function getFromCache<T>(key: string): T | null {
    try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : null
    } catch (error) {
        console.error(`Error reading from cache (${key}):`, error)
        return null
    }
}

function setInCache<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
        console.error(`Error writing to cache (${key}):`, error)
    }
}

function removeFromCache(key: string): void {
    try {
        localStorage.removeItem(key)
    } catch (error) {
        console.error(`Error removing from cache (${key}):`, error)
    }
}

// Specific cache functions

export function getCachedSelectedConnection(): string | null {
    return getFromCache<string>(CACHE_KEYS.SELECTED_CONNECTION)
}

export function setCachedSelectedConnection(connectionId: string): void {
    setInCache(CACHE_KEYS.SELECTED_CONNECTION, connectionId)
}

export function getCachedActiveTab(): string | null {
    return getFromCache<string>(CACHE_KEYS.ACTIVE_TAB)
}

export function setCachedActiveTab(tabId: string): void {
    setInCache(CACHE_KEYS.ACTIVE_TAB, tabId)
}

export function getCachedOpenTabs(): TabState[] {
    return getFromCache<TabState[]>(CACHE_KEYS.OPEN_TABS) || []
}

export function setCachedOpenTabs(tabs: TabState[]): void {
    setInCache(CACHE_KEYS.OPEN_TABS, tabs)
}

export function getCachedSchemaTreeState(connectionId: string): SchemaTreeState | null {
    const key = `${CACHE_KEYS.SCHEMA_TREE_STATE}_${connectionId}`
    return getFromCache<SchemaTreeState>(key)
}

export function setCachedSchemaTreeState(connectionId: string, state: SchemaTreeState): void {
    const key = `${CACHE_KEYS.SCHEMA_TREE_STATE}_${connectionId}`
    setInCache(key, state)
}

export function getCachedQueryEditorContent(tabId: string): string | null {
    const key = `${CACHE_KEYS.QUERY_EDITOR_CONTENT}_${tabId}`
    return getFromCache<string>(key)
}

export function setCachedQueryEditorContent(tabId: string, content: string): void {
    const key = `${CACHE_KEYS.QUERY_EDITOR_CONTENT}_${tabId}`
    setInCache(key, content)
}

export function removeCachedQueryEditorContent(tabId: string): void {
    const key = `${CACHE_KEYS.QUERY_EDITOR_CONTENT}_${tabId}`
    removeFromCache(key)
}

export function clearAllCache(): void {
    Object.values(CACHE_KEYS).forEach(key => removeFromCache(key))
}
