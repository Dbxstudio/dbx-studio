import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'DBX Studio',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#121212',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    })

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// IPC Handlers - Database queries
ipcMain.handle('db:postgres', async (_event, connectionString: string, query: string) => {
    // TODO: Implement postgres query execution
    console.log('PostgreSQL query:', { connectionString: '***', query })
    return { rows: [], rowCount: 0 }
})

ipcMain.handle('db:mysql', async (_event, connectionString: string, query: string) => {
    // TODO: Implement mysql query execution
    console.log('MySQL query:', { connectionString: '***', query })
    return { rows: [], rowCount: 0 }
})

// IPC Handlers - App info
ipcMain.handle('app:version', () => {
    return app.getVersion()
})

ipcMain.handle('app:platform', () => {
    return process.platform
})
