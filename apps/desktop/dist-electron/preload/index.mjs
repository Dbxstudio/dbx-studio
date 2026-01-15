import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electron", {
  // Database query methods
  query: {
    postgres: (connectionString, query, params) => ipcRenderer.invoke("db:postgres", connectionString, query, params),
    mysql: (connectionString, query, params) => ipcRenderer.invoke("db:mysql", connectionString, query, params),
    mssql: (connectionString, query, params) => ipcRenderer.invoke("db:mssql", connectionString, query, params),
    clickhouse: (connectionString, query, params) => ipcRenderer.invoke("db:clickhouse", connectionString, query, params)
  },
  // App methods
  app: {
    getVersion: () => ipcRenderer.invoke("app:version"),
    getPlatform: () => ipcRenderer.invoke("app:platform"),
    checkForUpdates: () => ipcRenderer.invoke("app:checkUpdates")
  },
  // Version info
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  }
});
