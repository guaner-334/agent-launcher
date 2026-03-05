import fs from 'fs'
import path from 'path'
import os from 'os'

const GLOBAL_CLAUDE_DIR = path.join(os.homedir(), '.claude')

export function ensureIsolatedConfig(
  configsDir: string,
  instanceId: string,
  apiBaseUrl?: string,
  apiKey?: string,
): string {
  const isolatedDir = path.join(configsDir, instanceId)
  const isolatedSettings = path.join(isolatedDir, 'settings.json')

  const isNew = !fs.existsSync(isolatedDir)
  if (isNew) {
    fs.mkdirSync(isolatedDir, { recursive: true })
  }

  let settings: Record<string, any> = {}
  const globalSettings = path.join(GLOBAL_CLAUDE_DIR, 'settings.json')
  if (fs.existsSync(globalSettings)) {
    try {
      settings = JSON.parse(fs.readFileSync(globalSettings, 'utf-8'))
    } catch {
      settings = {}
    }
  }

  settings.env = {}
  if (apiBaseUrl) {
    settings.env.ANTHROPIC_BASE_URL = apiBaseUrl
  }
  // API Key is NOT written to config files for security — passed via env at runtime

  fs.writeFileSync(isolatedSettings, JSON.stringify(settings, null, 2))

  const isolatedClaudeJson = path.join(isolatedDir, '.claude.json')
  if (isNew || !fs.existsSync(isolatedClaudeJson)) {
    let claudeJson: Record<string, any> = {}
    const globalClaudeJson = path.join(GLOBAL_CLAUDE_DIR, '.claude.json')
    if (fs.existsSync(globalClaudeJson)) {
      try {
        claudeJson = JSON.parse(fs.readFileSync(globalClaudeJson, 'utf-8'))
      } catch {
        claudeJson = {}
      }
    }
    claudeJson.hasCompletedOnboarding = true
    claudeJson.lastOnboardingVersion = claudeJson.lastOnboardingVersion || '2.1.0'
    if (apiKey) {
      const keySuffix = apiKey.slice(-20)
      if (!claudeJson.customApiKeyResponses) {
        claudeJson.customApiKeyResponses = { approved: [], rejected: [] }
      }
      if (!claudeJson.customApiKeyResponses.approved.includes(keySuffix)) {
        claudeJson.customApiKeyResponses.approved.push(keySuffix)
      }
    }
    fs.writeFileSync(isolatedClaudeJson, JSON.stringify(claudeJson, null, 2))
  }

  console.log(`[ConfigIsolation] Created/updated config for ${instanceId} → ${isolatedDir}`)
  return isolatedDir
}

export function removeIsolatedConfig(configsDir: string, instanceId: string): boolean {
  const isolatedDir = path.join(configsDir, instanceId)
  if (!fs.existsSync(isolatedDir)) return false

  try {
    fs.rmSync(isolatedDir, { recursive: true, force: true })
    console.log(`[ConfigIsolation] Removed config for ${instanceId}`)
    return true
  } catch (err) {
    console.error(`[ConfigIsolation] Failed to remove config for ${instanceId}:`, err)
    return false
  }
}
