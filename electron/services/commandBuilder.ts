import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { Instance } from './instanceStore'
import { ensureIsolatedConfig } from './configIsolation'

/** Escape a value for use inside a Windows batch `set "KEY=VALUE"` command */
function escapeBatchValue(value: string): string {
  return value
    .replace(/%/g, '%%')
    .replace(/"/g, '""')
    .replace(/\^/g, '^^')
    .replace(/&/g, '^&')
    .replace(/\|/g, '^|')
    .replace(/</g, '^<')
    .replace(/>/g, '^>')
}

/** Mask an API key for display: show prefix + last 4 chars */
function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  const prefix = key.slice(0, 4)
  const suffix = key.slice(-4)
  return `${prefix}••••${suffix}`
}

export class CommandBuilder {
  private configsDir: string
  private claudePath: string | null = null

  constructor(dataDir: string) {
    this.configsDir = path.join(dataDir, 'claude-configs')
    this.claudePath = this.findClaudeCli()
  }

  private findClaudeCli(): string | null {
    try {
      const result = execSync('where claude', { encoding: 'utf-8', timeout: 5000 }).trim()
      if (result) {
        const first = result.split(/\r?\n/)[0].trim()
        if (first && fs.existsSync(first)) return first
      }
    } catch {}

    const npmCacheDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx')
    if (fs.existsSync(npmCacheDir)) {
      try {
        const dirs = fs.readdirSync(npmCacheDir)
        for (const d of dirs) {
          const cmdPath = path.join(npmCacheDir, d, 'node_modules', '.bin', 'claude.cmd')
          if (fs.existsSync(cmdPath)) return cmdPath
        }
      } catch {}
    }

    const globalBinPaths = [
      path.join(process.env.APPDATA || '', 'npm', 'claude.cmd'),
      path.join(process.env.APPDATA || '', 'npm', 'claude'),
    ]
    for (const p of globalBinPaths) {
      if (fs.existsSync(p)) return p
    }

    return null
  }

  private buildEnvAndArgs(instance: Instance, masked: boolean): { envLines: string[]; cliLine: string } {
    const envLines: string[] = []

    if (instance.apiKey) {
      const value = masked ? maskKey(instance.apiKey) : escapeBatchValue(instance.apiKey)
      envLines.push(`set "ANTHROPIC_API_KEY=${value}"`)
    }
    if (instance.apiBaseUrl) {
      envLines.push(`set "ANTHROPIC_BASE_URL=${escapeBatchValue(instance.apiBaseUrl)}"`)
    }

    // Config isolation
    if (instance.claudeConfigDir) {
      envLines.push(`set "CLAUDE_CONFIG_DIR=${escapeBatchValue(instance.claudeConfigDir)}"`)
    } else if (instance.apiBaseUrl) {
      const autoConfigDir = ensureIsolatedConfig(
        this.configsDir, instance.id, instance.apiBaseUrl, instance.apiKey
      )
      envLines.push(`set "CLAUDE_CONFIG_DIR=${escapeBatchValue(autoConfigDir)}"`)
    }

    // Custom env vars
    if (instance.env) {
      for (const [key, value] of Object.entries(instance.env)) {
        envLines.push(`set "${escapeBatchValue(key)}=${escapeBatchValue(value)}"`)
      }
    }

    // CLI args
    const args: string[] = []
    if (instance.model) {
      args.push('--model', instance.model)
    }
    const permMode = instance.permissionMode || 'bypassPermissions'
    if (permMode !== 'default') {
      args.push('--permission-mode', permMode)
    }
    if (instance.systemPrompt) {
      args.push('--append-system-prompt', `"${escapeBatchValue(instance.systemPrompt)}"`)
    }

    const claudeCmd = this.claudePath || 'claude'
    const cliLine = `${claudeCmd}${args.length ? ' ' + args.join(' ') : ''}`

    return { envLines, cliLine }
  }

  /** Generate a display-safe command with masked API key */
  generateDisplayCommand(instance: Instance): string {
    const { envLines, cliLine } = this.buildEnvAndArgs(instance, true)
    const lines: string[] = []
    lines.push(`cd /d "${escapeBatchValue(instance.workingDirectory)}"`)
    lines.push(...envLines)
    lines.push(cliLine)
    return lines.join('\n')
  }

  /** Generate the full command with real API key (for clipboard copy) */
  generateFullCommand(instance: Instance): string {
    const { envLines, cliLine } = this.buildEnvAndArgs(instance, false)
    const lines: string[] = []
    lines.push(`cd /d "${escapeBatchValue(instance.workingDirectory)}"`)
    lines.push(...envLines)
    lines.push(cliLine)
    return lines.join('\n')
  }
}
