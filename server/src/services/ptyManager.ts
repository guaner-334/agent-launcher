import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { Instance } from '../types';
import { ensureIsolatedConfig } from './configIsolation';

type PtyEventCallback = (instanceId: string, data: any) => void;

interface PtyInstance {
  pty: pty.IPty;
  instanceId: string;
  logStream: fs.WriteStream;
  scrollbackBuffer: string[];
  scrollbackSize: number;
  startedAt: string;
}

const MAX_SCROLLBACK_CHARS = 100 * 1024; // 100KB per instance
const LOGS_DIR = path.resolve(__dirname, '../../../data/logs');

class PtyManager {
  private ptys: Map<string, PtyInstance> = new Map();
  private onDataCallback: PtyEventCallback | null = null;
  private onExitCallback: PtyEventCallback | null = null;

  onData(callback: PtyEventCallback): void {
    this.onDataCallback = callback;
  }

  onExit(callback: PtyEventCallback): void {
    this.onExitCallback = callback;
  }

  startInstance(instance: Instance, cols: number = 120, rows: number = 30): boolean {
    // Kill existing PTY if any
    this.stopInstance(instance.id);

    // Validate working directory
    if (!fs.existsSync(instance.workingDirectory)) {
      console.error(`[PTY] [${instance.id}] 工作目录不存在: ${instance.workingDirectory}`);
      return false;
    }

    // Build environment — filter out CLAUDECODE to avoid nested session detection
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      // Filter out CLAUDE* vars to prevent nested-session detection
      // Keep ANTHROPIC* vars as fallback auth (Claude CLI needs them for startup check)
      if (key.startsWith('CLAUDE') || value === undefined) continue;
      env[key] = value;
    }
    env.ComSpec = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`;

    if (!env.PATH && process.env.PATH) {
      env.PATH = process.env.PATH;
    }

    // Per-instance env overrides (lowest priority)
    if (instance.env) {
      Object.assign(env, instance.env);
    }

    // API configuration
    // Note: ANTHROPIC_AUTH_TOKEN from global ~/.claude/settings.json is needed
    // for Claude CLI startup connectivity check. Instance apiKey/apiBaseUrl
    // override actual API requests via env vars.
    if (instance.apiKey) {
      env.ANTHROPIC_API_KEY = instance.apiKey;
    }
    if (instance.apiBaseUrl) {
      env.ANTHROPIC_BASE_URL = instance.apiBaseUrl;
    } else {
      delete env.ANTHROPIC_BASE_URL;
    }

    // Isolate Claude config directory:
    // 1. Use explicit claudeConfigDir if user provided one
    // 2. Auto-create isolation when apiBaseUrl is set (avoids CC-Switch conflicts / 502)
    if (instance.claudeConfigDir) {
      env.CLAUDE_CONFIG_DIR = instance.claudeConfigDir;
    } else if (instance.apiBaseUrl) {
      const autoConfigDir = ensureIsolatedConfig(
        instance.id,
        instance.apiBaseUrl,
        instance.apiKey,
      );
      env.CLAUDE_CONFIG_DIR = autoConfigDir;
    }

    // Build CLI args for interactive mode (no -p, no --output-format)
    const args: string[] = [];
    if (instance.model) {
      args.push('--model', instance.model);
    }

    const permMode = instance.permissionMode || 'bypassPermissions';
    if (permMode !== 'default') {
      args.push('--permission-mode', permMode);
    }

    if (instance.systemPrompt) {
      args.push('--append-system-prompt', instance.systemPrompt);
    }

    // Create log directory and file
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const logPath = path.join(LOGS_DIR, `${instance.id}.log`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    const startedAt = new Date().toISOString();
    logStream.write(`\n--- Session started: ${startedAt} ---\n`);

    // Spawn PTY
    const shell = process.platform === 'win32'
      ? (process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`)
      : 'bash';
    const shellArgs = process.platform === 'win32'
      ? ['/c', 'claude', ...args]
      : ['-c', `claude ${args.join(' ')}`];

    console.log(`[PTY] [${instance.id}] Spawning: ${shell} ${shellArgs.join(' ')}`);

    let ptyProcess: pty.IPty;
    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: instance.workingDirectory,
        env,
      });
    } catch (err: any) {
      console.error(`[PTY] [${instance.id}] Spawn failed:`, err.message);
      logStream.end();
      return false;
    }

    const ptyInst: PtyInstance = {
      pty: ptyProcess,
      instanceId: instance.id,
      logStream,
      scrollbackBuffer: [],
      scrollbackSize: 0,
      startedAt,
    };

    this.ptys.set(instance.id, ptyInst);

    // Wire up data event
    ptyProcess.onData((data: string) => {
      // Write to log
      logStream.write(data);

      // Update scrollback buffer
      ptyInst.scrollbackBuffer.push(data);
      ptyInst.scrollbackSize += data.length;
      while (ptyInst.scrollbackSize > MAX_SCROLLBACK_CHARS && ptyInst.scrollbackBuffer.length > 1) {
        const removed = ptyInst.scrollbackBuffer.shift()!;
        ptyInst.scrollbackSize -= removed.length;
      }

      // Forward to socket
      if (this.onDataCallback) {
        this.onDataCallback(instance.id, { type: 'pty:data', data });
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY] [${instance.id}] Exited code=${exitCode} signal=${signal}`);
      logStream.write(`\n--- Session ended: ${new Date().toISOString()} (code=${exitCode}, signal=${signal}) ---\n`);
      logStream.end();
      this.ptys.delete(instance.id);

      if (this.onExitCallback) {
        this.onExitCallback(instance.id, { type: 'pty:exit', exitCode, signal });
      }
    });

    return true;
  }

  write(instanceId: string, data: string): boolean {
    const ptyInst = this.ptys.get(instanceId);
    if (!ptyInst) return false;
    ptyInst.pty.write(data);
    return true;
  }

  resize(instanceId: string, cols: number, rows: number): boolean {
    const ptyInst = this.ptys.get(instanceId);
    if (!ptyInst) return false;
    try {
      ptyInst.pty.resize(cols, rows);
    } catch (e) { /* ignore resize errors */ }
    return true;
  }

  getScrollback(instanceId: string): string {
    const ptyInst = this.ptys.get(instanceId);
    if (!ptyInst) return '';
    return ptyInst.scrollbackBuffer.join('');
  }

  getState(instanceId: string): 'idle' | 'running' | 'stopped' {
    return this.ptys.has(instanceId) ? 'running' : 'idle';
  }

  isRunning(instanceId: string): boolean {
    return this.ptys.has(instanceId);
  }

  stopInstance(instanceId: string): void {
    const ptyInst = this.ptys.get(instanceId);
    if (!ptyInst) return;

    // Remove from map first to prevent double-kill
    this.ptys.delete(instanceId);

    console.log(`[PTY] [${instanceId}] Stopping`);
    try {
      ptyInst.pty.kill();
    } catch (e) { /* ignore */ }
    // onExit handler will close log
  }

  stopAll(): void {
    for (const [id] of this.ptys) {
      this.stopInstance(id);
    }
  }

  getLogPath(instanceId: string): string {
    return path.join(LOGS_DIR, `${instanceId}.log`);
  }

  deleteLog(instanceId: string): boolean {
    const logPath = this.getLogPath(instanceId);
    try {
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
      return true;
    } catch (e) {
      return false;
    }
  }
}

export const ptyManager = new PtyManager();
