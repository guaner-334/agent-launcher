import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { InstanceStore, Instance } from '../services/instanceStore'
import { CommandBuilder } from '../services/commandBuilder'
import { removeIsolatedConfig } from '../services/configIsolation'

export function registerIpcHandlers(store: InstanceStore, commandBuilder: CommandBuilder) {
  const dataDir = (store as any).dataDir || path.resolve(process.cwd(), 'data')
  const configsDir = path.join(dataDir, 'claude-configs')

  ipcMain.handle('instances:list', () => {
    return store.getAll()
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
      env: data.env || undefined,
      claudeConfigDir: data.claudeConfigDir || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.create(instance)
    return instance
  })

  ipcMain.handle('instances:update', (_, id: string, data: Partial<Instance>) => {
    const existing = store.getById(id)
    if (!existing) throw new Error('Instance not found')

    const allowedFields = ['name', 'apiBaseUrl', 'apiKey', 'workingDirectory', 'model', 'systemPrompt', 'permissionMode', 'env', 'claudeConfigDir']
    const updates: Partial<Instance> = {}
    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        (updates as any)[field] = (data as any)[field]
      }
    }

    const updated = store.update(id, updates)
    if (!updated) throw new Error('Failed to update instance')
    return updated
  })

  ipcMain.handle('instances:delete', (_, id: string) => {
    removeIsolatedConfig(configsDir, id)
    store.delete(id)
  })

  ipcMain.handle('instances:generate-command', (_, id: string) => {
    const instance = store.getById(id)
    if (!instance) throw new Error('Instance not found')
    const display = commandBuilder.generateDisplayCommand(instance)
    const copyText = commandBuilder.generateFullCommand(instance)
    return { display, copyText }
  })

  // Filesystem browse
  ipcMain.handle('filesystem:browse', (_, dirPath?: string) => {
    if (!dirPath && process.platform === 'win32') {
      const drives: string[] = []
      for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i)
        const drive = `${letter}:\\`
        try {
          fs.accessSync(drive, fs.constants.R_OK)
          drives.push(drive)
        } catch {}
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
}
