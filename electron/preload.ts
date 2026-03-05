import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    create: (data: any) => ipcRenderer.invoke('instances:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('instances:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    start: (id: string) => ipcRenderer.invoke('instances:start', id),
    stop: (id: string) => ipcRenderer.invoke('instances:stop', id),
    moveKanban: (id: string, status: string) => ipcRenderer.invoke('instances:kanban-move', id, status),
    getSessions: (id: string) => ipcRenderer.invoke('instances:get-sessions', id),
    getSessionContent: (id: string, index: number) => ipcRenderer.invoke('instances:get-session-content', id, index),
    getLog: (id: string) => ipcRenderer.invoke('instances:get-log', id),
    deleteLog: (id: string) => ipcRenderer.invoke('instances:delete-log', id),
    openTerminal: (id: string) => ipcRenderer.invoke('instances:open-terminal', id),
  },
  terminal: {
    input: (instanceId: string, data: string) => ipcRenderer.send('terminal:input', { instanceId, data }),
    resize: (instanceId: string, cols: number, rows: number) => ipcRenderer.send('terminal:resize', { instanceId, cols, rows }),
    getScrollback: (instanceId: string) => ipcRenderer.invoke('terminal:get-scrollback', instanceId),
    ready: (instanceId: string) => ipcRenderer.send('terminal:ready', { instanceId }),
  },
  filesystem: {
    browse: (dirPath?: string) => ipcRenderer.invoke('filesystem:browse', dirPath),
  },
  settings: {
    getNotifications: () => ipcRenderer.invoke('settings:get-notifications'),
    setNotifications: (enabled: boolean) => ipcRenderer.invoke('settings:set-notifications', enabled),
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
})
