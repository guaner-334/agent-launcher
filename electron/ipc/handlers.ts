import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { InstanceStore, Instance } from '../services/instanceStore'
import { ProcessManager } from '../services/processManager'
import { removeIsolatedConfig } from '../services/configIsolation'

interface AppContext {
  createTerminalWindow: (id: string, name: string) => BrowserWindow | undefined
  focusTerminalWindow: (id: string) => boolean
  terminalWindows: Map<string, BrowserWindow>
  getNotificationsEnabled: () => boolean
  setNotificationsEnabled: (v: boolean) => void
}

function withRuntime(inst: Instance, processManager: ProcessManager) {
  return {
    ...inst,
    runtime: {
      processState: processManager.getState(inst.id),
      outputting: processManager.isOutputting(inst.id),
    },
  }
}

export function registerIpcHandlers(
  store: InstanceStore,
  processManager: ProcessManager,
  ctx: AppContext,
) {
  const dataDir = (store as any).dataDir || path.resolve(process.cwd(), 'data')
  const configsDir = path.join(dataDir, 'claude-configs')

  // === Instance CRUD ===

  ipcMain.handle('instances:list', () => {
    const instances = store.getAll()
    return instances.map(inst => withRuntime(inst, processManager))
  })

  ipcMain.handle('instances:create', (_, data: Partial<Instance>) => {
    if (!data.name || !data.workingDirectory) {
      throw new Error('name and workingDirectory are required')
    }
    const instance: Instance = {
      id: uuidv4(),
      name: data.name,
      apiBaseUrl: data.apiBaseUrl || undefined,
      apiKey: data.apiKey || undefined,
      workingDirectory: data.workingDirectory,
      model: data.model || undefined,
      systemPrompt: data.systemPrompt || undefined,
      permissionMode: data.permissionMode || 'bypassPermissions',
      kanbanStatus: (data.kanbanStatus as any) || 'todo',
      env: data.env || undefined,
      claudeConfigDir: data.claudeConfigDir || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.create(instance)
    return withRuntime(instance, processManager)
  })

  ipcMain.handle('instances:update', (_, id: string, data: Partial<Instance>) => {
    const existing = store.getById(id)
    if (!existing) throw new Error('Instance not found')

    const allowedFields = ['name', 'apiBaseUrl', 'apiKey', 'workingDirectory', 'model', 'systemPrompt', 'permissionMode', 'kanbanStatus', 'env', 'claudeConfigDir']
    const updates: Partial<Instance> = {}
    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        (updates as any)[field] = (data as any)[field]
      }
    }

    const updated = store.update(id, updates)
    if (!updated) throw new Error('Failed to update instance')
    return withRuntime(updated, processManager)
  })

  ipcMain.handle('instances:delete', (_, id: string) => {
    if (processManager.isRunning(id)) {
      processManager.stopInstance(id)
    }
    // Close terminal window
    const win = ctx.terminalWindows.get(id)
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
    processManager.deleteLog(id)
    removeIsolatedConfig(configsDir, id)
    store.delete(id)
  })

  // === Instance Actions ===

  ipcMain.handle('instances:start', (_, id: string) => {
    const instance = store.getById(id)
    if (!instance) throw new Error('Instance not found')
    const success = processManager.startInstance(instance)
    if (!success) throw new Error('启动失败，请检查工作目录是否存在')

    // Open terminal window
    ctx.createTerminalWindow(id, instance.name)

    return withRuntime(instance, processManager)
  })

  ipcMain.handle('instances:stop', (_, id: string) => {
    const instance = store.getById(id)
    if (!instance) throw new Error('Instance not found')

    processManager.stopInstance(id)
    return withRuntime(instance, processManager)
  })

  ipcMain.handle('instances:kanban-move', (_, id: string, status: string) => {
    if (!['todo', 'in-progress', 'review', 'done'].includes(status)) {
      throw new Error('Invalid kanban status')
    }
    const updated = store.update(id, { kanbanStatus: status as any })
    if (!updated) throw new Error('Instance not found')
    return withRuntime(updated, processManager)
  })

  ipcMain.handle('instances:open-terminal', (_, id: string) => {
    const instance = store.getById(id)
    if (!instance) throw new Error('Instance not found')

    if (!ctx.focusTerminalWindow(id)) {
      if (processManager.isRunning(id)) {
        ctx.createTerminalWindow(id, instance.name)
      }
    }
  })

  // === Session / Log ===

  ipcMain.handle('instances:get-sessions', (_, id: string) => {
    return processManager.getSessionHistory(id)
  })

  ipcMain.handle('instances:get-session-content', (_, id: string, index: number) => {
    return processManager.getSessionContent(id, index)
  })

  ipcMain.handle('instances:get-log', (_, id: string) => {
    const logPath = processManager.getLogPath(id)
    if (!fs.existsSync(logPath)) return null
    return fs.readFileSync(logPath, 'utf-8')
  })

  ipcMain.handle('instances:delete-log', (_, id: string) => {
    processManager.deleteLog(id)
  })

  // === Terminal I/O ===

  ipcMain.on('terminal:input', (_, { instanceId, data }: { instanceId: string; data: string }) => {
    processManager.write(instanceId, data)
  })

  ipcMain.on('terminal:resize', (_, { instanceId, cols, rows }: { instanceId: string; cols: number; rows: number }) => {
    processManager.resize(instanceId, cols, rows)
  })

  ipcMain.handle('terminal:get-scrollback', (_, instanceId: string) => {
    return processManager.getScrollback(instanceId)
  })

  ipcMain.on('terminal:ready', (_, { instanceId }: { instanceId: string }) => {
    // Terminal window is ready, send scrollback
    const scrollback = processManager.getScrollback(instanceId)
    const win = ctx.terminalWindows.get(instanceId)
    if (win && !win.isDestroyed() && scrollback) {
      win.webContents.send('terminal:scrollback', { instanceId, data: scrollback })
    }
  })

  // === Filesystem ===

  ipcMain.handle('filesystem:browse', (_, dirPath?: string) => {
    // Windows: no path → list drive letters
    if (!dirPath && process.platform === 'win32') {
      const drives: string[] = []
      for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i)
        const drive = `${letter}:\\`
        try {
          fs.accessSync(drive, fs.constants.R_OK)
          drives.push(drive)
        } catch { /* drive not accessible */ }
      }
      return { current: '', parent: null, directories: drives }
    }

    const browsePath = dirPath || '/'
    const resolved = path.resolve(browsePath)

    try {
      fs.accessSync(resolved, fs.constants.R_OK)
    } catch {
      throw new Error('Permission denied')
    }

    let entries: string[]
    try {
      const dirents = fs.readdirSync(resolved, { withFileTypes: true })
      entries = dirents
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    } catch (err: any) {
      throw new Error(err.message || 'Cannot read directory')
    }

    const parent = path.dirname(resolved)
    return {
      current: resolved,
      parent: parent !== resolved ? parent : null,
      directories: entries,
    }
  })

  // === Settings ===

  ipcMain.handle('settings:get-notifications', () => {
    return ctx.getNotificationsEnabled()
  })

  ipcMain.handle('settings:set-notifications', (_, enabled: boolean) => {
    ctx.setNotificationsEnabled(enabled)
  })
}
