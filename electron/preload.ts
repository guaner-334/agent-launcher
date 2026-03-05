import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    create: (data: any) => ipcRenderer.invoke('instances:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('instances:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('instances:delete', id),
    generateCommand: (id: string, shell?: string) => ipcRenderer.invoke('instances:generate-command', id, shell),
  },
  filesystem: {
    browse: (dirPath?: string) => ipcRenderer.invoke('filesystem:browse', dirPath),
  },
})
