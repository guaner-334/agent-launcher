import { EventEmitter } from 'events'
import { execSync } from 'child_process'
import * as pty from 'node-pty'
import fs from 'fs'
import path from 'path'
import { Instance, SessionEntry } from './instanceStore'
import { ensureIsolatedConfig } from './configIsolation'

function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[\[\]()#;?]*[0-9;]*[a-zA-Z]/g, '')
    .replace(/\r([^\n])/g, '\n$1')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

const AUTH_PATTERNS = [
  /Do you want to (?:proceed|create|allow|update|delete|remove|overwrite|replace|run|execute)/i,
  /Do you want to use this API key/i,
  /\(Y\)es\s*\/\s*\(N\)o/i,
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /Allow\s+(this|once|always)/i,
  /Press Enter to confirm/i,
  /Want to proceed\?/i,
  /approve this/i,
  /1\.\s*Yes\s+2\.\s*Yes,\s*allow/i,
  /❯\s*1\.\s*Yes/,
  /Is this a project you.*trust/i,
  /Enter to select.*to navigate/i,
  /Esc to cancel/,
]

const IDLE_PROMPT_PATTERNS = [
  />\s*$/m,
]

const TOKEN_REGEX = /\w+[…\.]+\s+\(([^·]+)\s*·\s*[↓↑]\s*([\d,.]+k?)\s*tokens/i

const MAX_SCROLLBACK_CHARS = 100 * 1024
const MAX_LINE_BUFFER = 2000
const BUSY_THRESHOLD = 200
const OUTPUT_IDLE_TIMEOUT = 3000
const RESIZE_SUPPRESS_MS = 1500

interface PtyInstance {
  pty: pty.IPty
  instanceId: string
  logStream: fs.WriteStream
  scrollbackBuffer: string[]
  scrollbackSize: number
  startedAt: string
  lineBuffer: string
  busy: boolean
  bytesSinceIdle: number
  tokenStats: { tokens: number; elapsed: string } | null
  lastUserPrompt: string
  inputBuffer: string
  outputting: boolean
  outputTimer: ReturnType<typeof setTimeout> | null
  pendingAuth: boolean
  authDetectedAt: number
  lastWriteTime: number
  resizeSuppressUntil: number
}

export class ProcessManager extends EventEmitter {
  private ptys = new Map<string, PtyInstance>()
  private dataDir: string
  private logsDir: string
  private configsDir: string
  private claudePath: string | null = null

  constructor(dataDir: string) {
    super()
    this.dataDir = dataDir
    this.logsDir = path.join(dataDir, 'logs')
    this.configsDir = path.join(dataDir, 'claude-configs')
    this.claudePath = this.findClaudeCli()
    console.log(`[PTY] Claude CLI resolved to: ${this.claudePath || '(not found, using PATH)'}`)
  }

  private findClaudeCli(): string | null {
    // 1. Check if claude is directly in PATH
    try {
      const result = execSync('where claude', { encoding: 'utf-8', timeout: 5000 }).trim()
      if (result) {
        const first = result.split(/\r?\n/)[0].trim()
        if (first && fs.existsSync(first)) return first
      }
    } catch { /* not in PATH */ }

    // 2. Check common npx cache locations
    const npmCacheDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx')
    if (fs.existsSync(npmCacheDir)) {
      try {
        const dirs = fs.readdirSync(npmCacheDir)
        for (const d of dirs) {
          const cmdPath = path.join(npmCacheDir, d, 'node_modules', '.bin', 'claude.cmd')
          if (fs.existsSync(cmdPath)) return cmdPath
        }
      } catch { /* ignore */ }
    }

    // 3. Check global npm bin
    const globalBinPaths = [
      path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      path.join(process.env.APPDATA || '', 'npm', 'claude'),
    ]
    for (const p of globalBinPaths) {
      if (fs.existsSync(p)) return p
    }

    console.warn('[PTY] Claude CLI not found in any known location. Falling back to PATH.')
    return null
  }

  getClaudePath(): string | null {
    return this.claudePath
  }

  private recheckAuthFromScrollback(instanceId: string, ptyInst: PtyInstance): boolean {
    if (ptyInst.pendingAuth) return false
    const tail = ptyInst.scrollbackBuffer.slice(-5).join('')
    const recentContent = stripAnsi(tail)
    for (const pattern of AUTH_PATTERNS) {
      if (pattern.test(recentContent)) {
        ptyInst.pendingAuth = true
        ptyInst.bytesSinceIdle = 0
        this.emit('auth-prompt', instanceId)
        return true
      }
    }
    return false
  }

  isRunning(instanceId: string): boolean {
    return this.ptys.has(instanceId)
  }

  isOutputting(instanceId: string): boolean {
    return this.ptys.get(instanceId)?.outputting ?? false
  }

  getTokenStats(instanceId: string): { tokens: number; elapsed: string } | null {
    return this.ptys.get(instanceId)?.tokenStats ?? null
  }

  getUserPrompt(instanceId: string): string {
    return this.ptys.get(instanceId)?.lastUserPrompt ?? ''
  }

  getState(instanceId: string): 'idle' | 'running' {
    return this.ptys.has(instanceId) ? 'running' : 'idle'
  }

  startInstance(instance: Instance, cols = 120, rows = 30): boolean {
    this.stopInstance(instance.id)

    if (!fs.existsSync(instance.workingDirectory)) {
      console.error(`[PTY] [${instance.id}] Working directory not found: ${instance.workingDirectory}`)
      return false
    }

    // Build environment
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if ((key.startsWith('CLAUDE') && key !== 'CLAUDE_CODE_GIT_BASH_PATH') || value === undefined) continue
      env[key] = value
    }
    env.ComSpec = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`

    if (!env.PATH && process.env.PATH) {
      env.PATH = process.env.PATH
    }

    // Windows: ensure git-bash path
    if (process.platform === 'win32' && !env.CLAUDE_CODE_GIT_BASH_PATH) {
      const candidates = [
        process.env.CLAUDE_CODE_GIT_BASH_PATH,
        'D:\\Git\\bin\\bash.exe',
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      ]
      for (const p of candidates) {
        if (p && fs.existsSync(p)) {
          env.CLAUDE_CODE_GIT_BASH_PATH = p
          break
        }
      }
    }

    // Per-instance env overrides
    if (instance.env) {
      Object.assign(env, instance.env)
    }

    // Clear inherited auth vars
    delete env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_AUTH_TOKEN
    delete env.ANTHROPIC_BASE_URL

    if (instance.apiKey) {
      env.ANTHROPIC_API_KEY = instance.apiKey
    }
    if (instance.apiBaseUrl) {
      env.ANTHROPIC_BASE_URL = instance.apiBaseUrl
    }

    // Isolate Claude config directory
    if (instance.claudeConfigDir) {
      env.CLAUDE_CONFIG_DIR = instance.claudeConfigDir
    } else if (instance.apiBaseUrl) {
      const autoConfigDir = ensureIsolatedConfig(
        this.configsDir,
        instance.id,
        instance.apiBaseUrl,
        instance.apiKey,
      )
      env.CLAUDE_CONFIG_DIR = autoConfigDir
    }

    // Build CLI args
    const args: string[] = []
    if (instance.model) {
      args.push('--model', instance.model)
    }
    const permMode = instance.permissionMode || 'bypassPermissions'
    if (permMode !== 'default') {
      args.push('--permission-mode', permMode)
    }
    if (instance.systemPrompt) {
      args.push('--append-system-prompt', instance.systemPrompt)
    }

    // Create log
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }
    const logPath = path.join(this.logsDir, `${instance.id}.log`)
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    const startedAt = new Date().toISOString()
    logStream.write(`\n--- Session started: ${startedAt} ---\n`)

    // Spawn PTY
    const claudeCmd = this.claudePath || 'claude'
    let shell: string
    let shellArgs: string[]

    if (process.platform === 'win32') {
      if (this.claudePath && this.claudePath.endsWith('.cmd')) {
        // Directly invoke the .cmd file via cmd.exe
        shell = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`
        shellArgs = ['/c', this.claudePath, ...args]
      } else {
        shell = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`
        shellArgs = ['/c', claudeCmd, ...args]
      }
    } else {
      shell = 'bash'
      shellArgs = ['-c', `${claudeCmd} ${args.join(' ')}`]
    }

    console.log(`[PTY] [${instance.id}] Spawning: ${shell} ${shellArgs.join(' ')}`)

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: instance.workingDirectory,
        env,
      })
    } catch (err: any) {
      console.error(`[PTY] [${instance.id}] Spawn failed:`, err.message)
      logStream.end()
      return false
    }

    const ptyInst: PtyInstance = {
      pty: ptyProcess,
      instanceId: instance.id,
      logStream,
      scrollbackBuffer: [],
      scrollbackSize: 0,
      startedAt,
      lineBuffer: '',
      busy: false,
      bytesSinceIdle: 0,
      tokenStats: null,
      lastUserPrompt: '',
      inputBuffer: '',
      outputting: false,
      outputTimer: null,
      pendingAuth: false,
      authDetectedAt: 0,
      lastWriteTime: 0,
      resizeSuppressUntil: 0,
    }

    this.ptys.set(instance.id, ptyInst)

    // Wire up data event
    ptyProcess.onData((data: string) => {
      logStream.write(data)

      // Update scrollback buffer
      ptyInst.scrollbackBuffer.push(data)
      ptyInst.scrollbackSize += data.length
      while (ptyInst.scrollbackSize > MAX_SCROLLBACK_CHARS && ptyInst.scrollbackBuffer.length > 1) {
        const removed = ptyInst.scrollbackBuffer.shift()!
        ptyInst.scrollbackSize -= removed.length
      }

      // Forward to terminal window
      this.emit('pty-data', instance.id, data)

      // Pattern matching
      const stripped = stripAnsi(data)
      ptyInst.lineBuffer += stripped
      if (ptyInst.lineBuffer.length > MAX_LINE_BUFFER) {
        ptyInst.lineBuffer = ptyInst.lineBuffer.slice(-MAX_LINE_BUFFER)
      }

      // Token stats
      const tokenMatch = TOKEN_REGEX.exec(stripped) || TOKEN_REGEX.exec(ptyInst.lineBuffer)
      if (tokenMatch) {
        const elapsed = tokenMatch[1].trim()
        const rawTokens = tokenMatch[2]
        let tokens: number
        if (rawTokens.toLowerCase().endsWith('k')) {
          tokens = Math.round(parseFloat(rawTokens.slice(0, -1)) * 1000)
        } else {
          tokens = parseInt(rawTokens.replace(/,/g, ''), 10)
        }
        if (!isNaN(tokens)) {
          ptyInst.tokenStats = { tokens, elapsed }
          this.emit('token-stats', instance.id, { tokens, elapsed })
        }
      }

      // Auth prompt detection
      let authDetected = false
      for (const pattern of AUTH_PATTERNS) {
        if (pattern.test(stripped) || pattern.test(ptyInst.lineBuffer)) {
          authDetected = true
          break
        }
      }
      if (authDetected) {
        ptyInst.pendingAuth = true
        ptyInst.authDetectedAt = Date.now()
        this.emit('auth-prompt', instance.id)
        ptyInst.lineBuffer = ''
        ptyInst.bytesSinceIdle = 0
        if (ptyInst.outputting) {
          ptyInst.outputting = false
          if (ptyInst.outputTimer) { clearTimeout(ptyInst.outputTimer); ptyInst.outputTimer = null }
          this.emit('output-state', instance.id, false)
        }
      }

      // Output state + task completion
      const visibleLen = stripped.trim().length
      const suppressedByResize = Date.now() < ptyInst.resizeSuppressUntil

      if (visibleLen > 0 && !suppressedByResize) {
        ptyInst.bytesSinceIdle += stripped.length
        ptyInst.busy = true

        if (ptyInst.pendingAuth && ptyInst.bytesSinceIdle > BUSY_THRESHOLD
            && ptyInst.lastWriteTime > ptyInst.authDetectedAt) {
          ptyInst.pendingAuth = false
          this.emit('auth-cleared', instance.id)
        }

        if (!ptyInst.pendingAuth) {
          if (!ptyInst.outputting && ptyInst.bytesSinceIdle > BUSY_THRESHOLD) {
            ptyInst.outputting = true
            this.emit('output-state', instance.id, true)
          }
          if (ptyInst.outputting) {
            if (ptyInst.outputTimer) clearTimeout(ptyInst.outputTimer)
            ptyInst.outputTimer = setTimeout(() => {
              ptyInst.outputTimer = null
              if (ptyInst.outputting) {
                ptyInst.outputting = false
                this.emit('output-state', instance.id, false)
                const authFound = this.recheckAuthFromScrollback(instance.id, ptyInst)
                if (!authFound && !ptyInst.pendingAuth) {
                  this.emit('task-complete', instance.id)
                }
              }
            }, OUTPUT_IDLE_TIMEOUT)
          }
        }
      }

      // Idle prompt detection
      if (!suppressedByResize && ptyInst.busy && ptyInst.bytesSinceIdle > BUSY_THRESHOLD) {
        for (const pattern of IDLE_PROMPT_PATTERNS) {
          if (pattern.test(ptyInst.lineBuffer)) {
            if (ptyInst.pendingAuth) {
              ptyInst.pendingAuth = false
              this.emit('auth-cleared', instance.id)
            } else {
              if (!this.recheckAuthFromScrollback(instance.id, ptyInst)) {
                this.emit('task-complete', instance.id)
              }
            }
            ptyInst.busy = false
            ptyInst.bytesSinceIdle = 0
            ptyInst.lineBuffer = ''
            if (ptyInst.outputting) {
              ptyInst.outputting = false
              if (ptyInst.outputTimer) { clearTimeout(ptyInst.outputTimer); ptyInst.outputTimer = null }
              this.emit('output-state', instance.id, false)
            }
            break
          }
        }
      }
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] [${instance.id}] Exited code=${exitCode} signal=${signal}`)
      logStream.write(`\n--- Session ended: ${new Date().toISOString()} (code=${exitCode}, signal=${signal}) ---\n`)
      logStream.end()
      if (ptyInst.outputTimer) clearTimeout(ptyInst.outputTimer)
      this.ptys.delete(instance.id)
      this.emit('pty-exit', instance.id, exitCode, signal)
    })

    return true
  }

  write(instanceId: string, data: string): boolean {
    const ptyInst = this.ptys.get(instanceId)
    if (!ptyInst) return false
    ptyInst.pty.write(data)

    ptyInst.lastWriteTime = Date.now()
    ptyInst.bytesSinceIdle = 0

    if (ptyInst.outputting) {
      ptyInst.outputting = false
      if (ptyInst.outputTimer) { clearTimeout(ptyInst.outputTimer); ptyInst.outputTimer = null }
      this.emit('output-state', instanceId, false)
      if (!ptyInst.pendingAuth) {
        this.emit('task-complete', instanceId)
      }
    }

    // Track user input for prompt display
    for (const ch of data) {
      if (ch === '\r' || ch === '\n') {
        const trimmed = ptyInst.inputBuffer.trim()
        if (trimmed.length > 0) {
          ptyInst.lastUserPrompt = trimmed
          this.emit('user-prompt', instanceId, trimmed)
        }
        ptyInst.inputBuffer = ''
      } else if (ch === '\x7f' || ch === '\b') {
        ptyInst.inputBuffer = ptyInst.inputBuffer.slice(0, -1)
      } else if (ch.charCodeAt(0) >= 32 && !ch.startsWith('\x1b')) {
        ptyInst.inputBuffer += ch
      }
    }

    return true
  }

  resize(instanceId: string, cols: number, rows: number): boolean {
    const ptyInst = this.ptys.get(instanceId)
    if (!ptyInst) return false
    ptyInst.resizeSuppressUntil = Date.now() + RESIZE_SUPPRESS_MS
    try {
      ptyInst.pty.resize(cols, rows)
    } catch { /* ignore */ }
    return true
  }

  getScrollback(instanceId: string): string {
    const ptyInst = this.ptys.get(instanceId)
    if (!ptyInst) return ''
    return ptyInst.scrollbackBuffer.join('')
  }

  stopInstance(instanceId: string): void {
    const ptyInst = this.ptys.get(instanceId)
    if (!ptyInst) return
    this.ptys.delete(instanceId)
    if (ptyInst.outputTimer) clearTimeout(ptyInst.outputTimer)
    console.log(`[PTY] [${instanceId}] Stopping`)
    try {
      ptyInst.pty.kill()
    } catch { /* ignore */ }
  }

  stopAll(): void {
    for (const [id] of this.ptys) {
      this.stopInstance(id)
    }
  }

  getLogPath(instanceId: string): string {
    return path.join(this.logsDir, `${instanceId}.log`)
  }

  deleteLog(instanceId: string): boolean {
    const logPath = this.getLogPath(instanceId)
    try {
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath)
      return true
    } catch {
      return false
    }
  }

  getSessionHistory(instanceId: string): SessionEntry[] {
    const logPath = this.getLogPath(instanceId)
    if (!fs.existsSync(logPath)) return []

    const content = fs.readFileSync(logPath, 'utf-8')
    const sessions: SessionEntry[] = []

    const startRegex = /--- Session started: (.+?) ---/g
    const endRegex = /--- Session ended: (.+?) \(code=(.+?), signal=(.+?)\) ---/g

    const starts: { time: string; index: number; endIndex: number }[] = []
    let match
    while ((match = startRegex.exec(content)) !== null) {
      starts.push({ time: match[1], index: match.index, endIndex: match.index + match[0].length })
    }

    const ends: { time: string; exitCode: string; signal: string; index: number }[] = []
    while ((match = endRegex.exec(content)) !== null) {
      ends.push({ time: match[1], exitCode: match[2], signal: match[3], index: match.index })
    }

    for (const start of starts) {
      const matchingEnd = ends.find(e => e.index > start.index)
      if (matchingEnd) {
        ends.splice(ends.indexOf(matchingEnd), 1)
      }
      const exitCode = matchingEnd ? parseInt(matchingEnd.exitCode, 10) : null
      sessions.push({
        startedAt: start.time,
        endedAt: matchingEnd?.time || null,
        exitCode: exitCode !== null && !isNaN(exitCode) ? exitCode : null,
        signal: matchingEnd ? (matchingEnd.signal === 'undefined' ? null : matchingEnd.signal) : null,
      })
    }

    return sessions
  }

  getSessionContent(instanceId: string, sessionIndex: number): string | null {
    const logPath = this.getLogPath(instanceId)
    if (!fs.existsSync(logPath)) return null

    const content = fs.readFileSync(logPath, 'utf-8')
    const startRegex = /--- Session started: .+? ---\n?/g
    const endRegex = /\n?--- Session ended: .+? ---/g

    const starts: { index: number; endIndex: number }[] = []
    let match
    while ((match = startRegex.exec(content)) !== null) {
      starts.push({ index: match.index, endIndex: match.index + match[0].length })
    }

    if (sessionIndex < 0 || sessionIndex >= starts.length) return null

    const contentStart = starts[sessionIndex].endIndex
    endRegex.lastIndex = contentStart
    const endMatch = endRegex.exec(content)
    const contentEnd = endMatch ? endMatch.index : (
      sessionIndex + 1 < starts.length ? starts[sessionIndex + 1].index : content.length
    )

    return content.slice(contentStart, contentEnd)
  }
}
