export interface Instance {
  id: string
  name: string
  apiBaseUrl?: string
  apiKey?: string
  workingDirectory: string
  model?: string
  systemPrompt?: string
  permissionMode?: string
  claudeConfigDir?: string
  env?: Record<string, string>
  kanbanStatus: KanbanStatus
  createdAt: string
  updatedAt: string
}

export interface InstanceRuntime {
  processState: 'idle' | 'running' | 'stopped'
  outputting?: boolean
}

export interface InstanceWithRuntime extends Instance {
  runtime: InstanceRuntime
}

export type KanbanStatus = 'todo' | 'in-progress' | 'review' | 'done'

export interface SessionEntry {
  startedAt: string
  endedAt: string | null
  exitCode: number | null
  signal: string | null
}

export interface ElectronAPI {
  instances: {
    list(): Promise<InstanceWithRuntime[]>
    create(data: Partial<Instance>): Promise<InstanceWithRuntime>
    update(id: string, data: Partial<Instance>): Promise<InstanceWithRuntime>
    delete(id: string): Promise<void>
    start(id: string): Promise<InstanceWithRuntime>
    stop(id: string): Promise<InstanceWithRuntime>
    moveKanban(id: string, status: string): Promise<InstanceWithRuntime>
    getSessions(id: string): Promise<SessionEntry[]>
    getSessionContent(id: string, index: number): Promise<string | null>
    getLog(id: string): Promise<string | null>
    deleteLog(id: string): Promise<void>
    openTerminal(id: string): Promise<void>
  }
  terminal: {
    input(instanceId: string, data: string): void
    resize(instanceId: string, cols: number, rows: number): void
    getScrollback(instanceId: string): Promise<string>
    ready(instanceId: string): void
  }
  filesystem: {
    browse(dirPath?: string): Promise<{ current: string; parent: string | null; directories: string[] }>
  }
  settings: {
    getNotifications(): Promise<boolean>
    setNotifications(enabled: boolean): Promise<void>
  }
  on(channel: string, callback: (...args: any[]) => void): () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
