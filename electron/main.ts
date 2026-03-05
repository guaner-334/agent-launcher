import { app, BrowserWindow, Tray, Menu, Notification, nativeImage } from 'electron'
import path from 'path'
import { ProcessManager } from './services/processManager'
import { InstanceStore } from './services/instanceStore'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null
const terminalWindows = new Map<string, BrowserWindow>()

const dataDir = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')
  : path.join(process.cwd(), 'data')

const store = new InstanceStore(dataDir)
const processManager = new ProcessManager(dataDir)

let tray: Tray | null = null
let notificationsEnabled = true

function getPreloadPath() {
  return path.join(__dirname, 'preload.js')
}

function getRendererURL(query = '') {
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}${query ? '?' + query : ''}`
  }
  return '' // will use loadFile instead
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#111827',
    title: 'AgentManager',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = getRendererURL()
  if (url) {
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

export function createTerminalWindow(instanceId: string, instanceName: string) {
  const existing = terminalWindows.get(instanceId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 400,
    minHeight: 300,
    backgroundColor: '#1e1e1e',
    title: `Terminal - ${instanceName}`,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const query = `window=terminal&instanceId=${encodeURIComponent(instanceId)}`
  const url = getRendererURL(query)
  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      search: query,
    })
  }

  win.on('closed', () => {
    terminalWindows.delete(instanceId)
  })

  terminalWindows.set(instanceId, win)
  return win
}

export function focusTerminalWindow(instanceId: string) {
  const win = terminalWindows.get(instanceId)
  if (win && !win.isDestroyed()) {
    win.focus()
    return true
  }
  return false
}

function setupProcessManagerEvents() {
  processManager.on('pty-data', (instanceId: string, data: string) => {
    const win = terminalWindows.get(instanceId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal:data', { instanceId, data })
    }
  })

  processManager.on('pty-exit', (instanceId: string, exitCode: number, signal: string | null) => {
    const win = terminalWindows.get(instanceId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal:exit', { instanceId, exitCode, signal })
    }
    // Notify main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:status-changed', { instanceId, state: 'idle' })
    }
  })

  processManager.on('status-change', (instanceId: string, state: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:status-changed', { instanceId, state })
    }
  })

  processManager.on('auth-prompt', (instanceId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:auth-prompt', { instanceId })
    }
    // System notification
    if (notificationsEnabled) {
      const inst = store.getById(instanceId)
      const name = inst?.name || instanceId
      new Notification({
        title: 'AgentManager - 待确认',
        body: `${name} 需要确认操作`,
      }).show()
    }
  })

  processManager.on('auth-cleared', (instanceId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:auth-cleared', { instanceId })
    }
  })

  processManager.on('task-complete', (instanceId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:task-complete', { instanceId })
    }
    if (notificationsEnabled) {
      const inst = store.getById(instanceId)
      const name = inst?.name || instanceId
      new Notification({
        title: 'AgentManager - 已完成',
        body: `${name} 任务已完成`,
      }).show()
    }
  })

  processManager.on('token-stats', (instanceId: string, stats: { tokens: number; elapsed: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:token-stats', { instanceId, ...stats })
    }
  })

  processManager.on('user-prompt', (instanceId: string, prompt: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:user-prompt', { instanceId, prompt })
    }
  })

  processManager.on('output-state', (instanceId: string, outputting: boolean) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('instance:output-state', { instanceId, outputting })
    }
  })
}

function createTray() {
  // Create a simple 16x16 icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAWklEQVQ4T2NkYPj/n4EBBRiRBZgYkAUYGf4zIAsw/GdkQBZgZPjPgCzAwMjwH1mAgZERWQCuxchAFjBqwGAIg8EQBoMhDAZDGIANGE2JoykR2whiNKaMpkQAx2wgEWnBvVEAAAAASUVORK5CYII=',
      'base64'
    )
  )

  tray = new Tray(icon)
  tray.setToolTip('AgentManager')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        processManager.stopAll()
        // Close all terminal windows
        for (const [, win] of terminalWindows) {
          if (!win.isDestroyed()) win.destroy()
        }
        tray?.destroy()
        tray = null
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  setupProcessManagerEvents()
  registerIpcHandlers(store, processManager, {
    createTerminalWindow,
    focusTerminalWindow,
    terminalWindows,
    getNotificationsEnabled: () => notificationsEnabled,
    setNotificationsEnabled: (v: boolean) => { notificationsEnabled = v },
  })
})

app.on('window-all-closed', () => {
  // Don't quit — tray keeps running
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})

app.on('before-quit', () => {
  processManager.stopAll()
  tray?.destroy()
  tray = null
})
