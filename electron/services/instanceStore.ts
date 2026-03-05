import fs from 'fs'
import path from 'path'
import { encrypt, decrypt } from './crypto'

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

export class InstanceStore {
  private instances: Instance[] = []
  private dataDir: string
  private dataFile: string

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.dataFile = path.join(dataDir, 'instances.json')
    this.load()
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8')
        const raw = JSON.parse(data) as any[]
        this.instances = raw.map(({ kanbanStatus, ...rest }) => ({
          ...rest,
          apiKey: rest.apiKey ? decrypt(rest.apiKey) : undefined,
        }))
        // Auto-migrate: re-save to encrypt any plaintext keys
        this.save()
      } else {
        this.instances = []
        this.save()
      }
    } catch (err) {
      console.error('Failed to load store:', err)
      this.instances = []
    }
  }

  private save(): void {
    try {
      const toWrite = this.instances.map(inst => ({
        ...inst,
        apiKey: inst.apiKey ? encrypt(inst.apiKey) : undefined,
      }))
      fs.writeFileSync(this.dataFile, JSON.stringify(toWrite, null, 2))
    } catch (err) {
      console.error('Failed to save store:', err)
    }
  }

  getAll(): Instance[] {
    return [...this.instances]
  }

  getById(id: string): Instance | undefined {
    return this.instances.find(i => i.id === id)
  }

  create(instance: Instance): Instance {
    this.instances.push(instance)
    this.save()
    return instance
  }

  update(id: string, updates: Partial<Instance>): Instance | undefined {
    const index = this.instances.findIndex(i => i.id === id)
    if (index === -1) return undefined
    this.instances[index] = { ...this.instances[index], ...updates, updatedAt: new Date().toISOString() }
    this.save()
    return this.instances[index]
  }

  delete(id: string): boolean {
    const index = this.instances.findIndex(i => i.id === id)
    if (index === -1) return false
    this.instances.splice(index, 1)
    this.save()
    return true
  }
}
