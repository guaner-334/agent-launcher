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
  createdAt: string
  updatedAt: string
}

export interface GenerateCommandResult {
  display: string
  copyText: string
}

export interface ElectronAPI {
  instances: {
    list(): Promise<Instance[]>
    create(data: Partial<Instance>): Promise<Instance>
    update(id: string, data: Partial<Instance>): Promise<Instance>
    delete(id: string): Promise<void>
    generateCommand(id: string): Promise<GenerateCommandResult>
  }
  filesystem: {
    browse(dirPath?: string): Promise<{ current: string; parent: string | null; directories: string[] }>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
