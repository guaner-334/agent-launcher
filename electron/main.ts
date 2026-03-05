import { app, BrowserWindow } from 'electron'
import path from 'path'
import { InstanceStore } from './services/instanceStore'
import { CommandBuilder } from './services/commandBuilder'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

const dataDir = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(process.cwd(), 'data')

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#111827',
    title: 'Agent启动器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize after app ready so safeStorage is available
  const store = new InstanceStore(dataDir)
  const commandBuilder = new CommandBuilder(dataDir)

  createMainWindow()
  registerIpcHandlers(store, commandBuilder)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})
