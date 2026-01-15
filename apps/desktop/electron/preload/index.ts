import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
    // Database query methods
    query: {
        postgres: (connectionString: string, query: string, params?: unknown[]) =>
            ipcRenderer.invoke('db:postgres', connectionString, query, params),
        mysql: (connectionString: string, query: string, params?: unknown[]) =>
            ipcRenderer.invoke('db:mysql', connectionString, query, params),
        mssql: (connectionString: string, query: string, params?: unknown[]) =>
            ipcRenderer.invoke('db:mssql', connectionString, query, params),
        clickhouse: (connectionString: string, query: string, params?: unknown[]) =>
            ipcRenderer.invoke('db:clickhouse', connectionString, query, params),
    },

    // App methods
    app: {
        getVersion: () => ipcRenderer.invoke('app:version'),
        getPlatform: () => ipcRenderer.invoke('app:platform'),
        checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
    },

    // Version info
    versions: {
        node: () => process.versions.node,
        chrome: () => process.versions.chrome,
        electron: () => process.versions.electron,
    },
})

// Type definitions for the exposed API
declare global {
    interface Window {
        electron: {
            query: {
                postgres: (connectionString: string, query: string, params?: unknown[]) => Promise<unknown>
                mysql: (connectionString: string, query: string, params?: unknown[]) => Promise<unknown>
                mssql: (connectionString: string, query: string, params?: unknown[]) => Promise<unknown>
                clickhouse: (connectionString: string, query: string, params?: unknown[]) => Promise<unknown>
            }
            app: {
                getVersion: () => Promise<string>
                getPlatform: () => Promise<string>
                checkForUpdates: () => Promise<unknown>
            }
            versions: {
                node: () => string
                chrome: () => string
                electron: () => string
            }
        }
    }
}
