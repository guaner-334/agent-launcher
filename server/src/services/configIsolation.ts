import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIGS_DIR = path.resolve(__dirname, '../../../data/claude-configs');
const GLOBAL_CLAUDE_DIR = path.join(os.homedir(), '.claude');

/**
 * Auto-create an isolated Claude config directory for an instance.
 *
 * CLAUDE_CONFIG_DIR overrides ~/.claude/ — the settings.json inside it
 * controls API endpoint routing (env.ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY).
 *
 * Layout:
 *   data/claude-configs/{instanceId}/   ← this path is set as CLAUDE_CONFIG_DIR
 *     settings.json                     ← global settings + instance overrides
 *
 * Returns the config dir path to use as CLAUDE_CONFIG_DIR.
 */
export function ensureIsolatedConfig(
  instanceId: string,
  apiBaseUrl?: string,
  apiKey?: string,
): string {
  const isolatedDir = path.join(CONFIGS_DIR, instanceId);
  const isolatedSettings = path.join(isolatedDir, 'settings.json');

  if (!fs.existsSync(isolatedDir)) {
    fs.mkdirSync(isolatedDir, { recursive: true });
  }

  // Read global settings as base
  let settings: Record<string, any> = {};
  const globalSettings = path.join(GLOBAL_CLAUDE_DIR, 'settings.json');
  if (fs.existsSync(globalSettings)) {
    try {
      settings = JSON.parse(fs.readFileSync(globalSettings, 'utf-8'));
    } catch {
      settings = {};
    }
  }
  if (!settings.env) {
    settings.env = {};
  }

  // Override with instance-specific API config
  if (apiBaseUrl) {
    settings.env.ANTHROPIC_BASE_URL = apiBaseUrl;
  }
  if (apiKey) {
    settings.env.ANTHROPIC_API_KEY = apiKey;
    delete settings.env.ANTHROPIC_AUTH_TOKEN;
  }

  fs.writeFileSync(isolatedSettings, JSON.stringify(settings, null, 2));
  console.log(`[ConfigIsolation] Created/updated config for ${instanceId} → ${isolatedDir}`);

  return isolatedDir;
}

/**
 * Remove the isolated config directory for an instance.
 */
export function removeIsolatedConfig(instanceId: string): boolean {
  const isolatedDir = path.join(CONFIGS_DIR, instanceId);
  if (!fs.existsSync(isolatedDir)) return false;

  try {
    fs.rmSync(isolatedDir, { recursive: true, force: true });
    console.log(`[ConfigIsolation] Removed config for ${instanceId}`);
    return true;
  } catch (err) {
    console.error(`[ConfigIsolation] Failed to remove config for ${instanceId}:`, err);
    return false;
  }
}
