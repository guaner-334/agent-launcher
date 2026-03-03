import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { Instance, SessionEntry } from '../types';
import { ensureIsolatedConfig } from './configIsolation';

type PtyEventCallback = (instanceId: string, data: any) => void;

// Strip ANSI escape sequences and terminal control chars for pattern matching
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')   // CSI sequences (incl ?25h etc)
    .replace(/\x1b\][^\x07]*\x07/g, '')         // OSC sequences
    .replace(/\x1b[\[\]()#;?]*[0-9;]*[a-zA-Z]/g, '') // remaining ESC sequences
    .replace(/\r([^\n])/g, '\n$1')              // CR without LF → treat as newline
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''); // control chars (keep \t \n \r)
}

// Patterns that indicate Claude Code is asking for user approval
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
];

// Patterns that indicate Claude Code is idle (waiting for user input)
const IDLE_PROMPT_PATTERNS = [
  />\s*$/m,
];

interface TokenStats {
  tokens: number;
  elapsed: string;
}

interface PtyInstance {
  pty: pty.IPty;
  instanceId: string;
  logStream: fs.WriteStream;
  scrollbackBuffer: string[];
  scrollbackSize: number;
  startedAt: string;
  lineBuffer: string;
  busy: boolean;
  bytesSinceIdle: number;
  tokenStats: TokenStats | null;
}

const MAX_SCROLLBACK_CHARS = 100 * 1024; // 100KB per instance
const MAX_LINE_BUFFER = 2000;
const BUSY_THRESHOLD = 200;
const LOGS_DIR = path.resolve(__dirname, '../../../data/logs');
const TOKEN_REGEX = /Working[…\.]+\s+\(([^·]+)\s*·\s*[↓↑]\s*([\d,]+)\s*tokens/;

class PtyManager {
  private ptys: Map<string, PtyInstance> = new Map();
  private onDataCallback: PtyEventCallback | null = null;
  private onExitCallback: PtyEventCallback | null = null;
  private onAuthPromptCallback: PtyEventCallback | null = null;
  private onTaskCompleteCallback: PtyEventCallback | null = null;
  private onTokenStatsCallback: PtyEventCallback | null = null;

  onData(callback: PtyEventCallback): void {
    this.onDataCallback = callback;
  }

  onExit(callback: PtyEventCallback): void {
    this.onExitCallback = callback;
  }

  onAuthPrompt(callback: PtyEventCallback): void {
    this.onAuthPromptCallback = callback;
  }

  onTaskComplete(callback: PtyEventCallback): void {
    this.onTaskCompleteCallback = callback;
  }

  onTokenStats(callback: PtyEventCallback): void {
    this.onTokenStatsCallback = callback;
  }

  getTokenStats(instanceId: string): TokenStats | null {
    const ptyInst = this.ptys.get(instanceId);
    return ptyInst?.tokenStats ?? null;
  }

  startInstance(instance: Instance, cols: number = 120, rows: number = 30): boolean {
    // Kill existing PTY if any
    this.stopInstance(instance.id);

    // Validate working directory
    if (!fs.existsSync(instance.workingDirectory)) {
      console.error(`[PTY] [${instance.id}] Working directory not found: ${instance.workingDirectory}`);
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
    if (instance.apiKey) {
      env.ANTHROPIC_API_KEY = instance.apiKey;
    }
    if (instance.apiBaseUrl) {
      env.ANTHROPIC_BASE_URL = instance.apiBaseUrl;
    } else {
      delete env.ANTHROPIC_BASE_URL;
    }

    // Isolate Claude config directory
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
      lineBuffer: '',
      busy: false,
      bytesSinceIdle: 0,
      tokenStats: null,
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

      // Pattern matching on stripped text
      const stripped = stripAnsi(data);

      // Accumulate into lineBuffer first so all detections see current chunk
      ptyInst.lineBuffer += stripped;
      if (ptyInst.lineBuffer.length > MAX_LINE_BUFFER) {
        ptyInst.lineBuffer = ptyInst.lineBuffer.slice(-MAX_LINE_BUFFER);
      }

      // Token stats detection on raw stripped chunk and accumulated lineBuffer
      if (this.onTokenStatsCallback) {
        const tokenMatch = TOKEN_REGEX.exec(stripped) || TOKEN_REGEX.exec(ptyInst.lineBuffer);
        if (tokenMatch) {
          const elapsed = tokenMatch[1].trim();
          const tokens = parseInt(tokenMatch[2].replace(/,/g, ''), 10);
          if (!isNaN(tokens)) {
            ptyInst.tokenStats = { tokens, elapsed };
            this.onTokenStatsCallback(instance.id, { tokens, elapsed });
          }
        }
      }

      // Auth prompt detection — match on both raw chunk and accumulated lineBuffer
      if (this.onAuthPromptCallback) {
        let authDetected = false;
        for (const pattern of AUTH_PATTERNS) {
          if (pattern.test(stripped) || pattern.test(ptyInst.lineBuffer)) {
            authDetected = true;
            break;
          }
        }
        if (authDetected) {
          this.onAuthPromptCallback(instance.id, { type: 'instance:authPrompt' });
          ptyInst.lineBuffer = '';
        }
      }

      // Task completion detection
      ptyInst.bytesSinceIdle += stripped.length;
      if (stripped.trim().length > 0) {
        ptyInst.busy = true;
      }
      if (this.onTaskCompleteCallback && ptyInst.busy && ptyInst.bytesSinceIdle > BUSY_THRESHOLD) {
        for (const pattern of IDLE_PROMPT_PATTERNS) {
          if (pattern.test(ptyInst.lineBuffer)) {
            this.onTaskCompleteCallback(instance.id, { type: 'instance:taskComplete' });
            ptyInst.busy = false;
            ptyInst.bytesSinceIdle = 0;
            ptyInst.lineBuffer = '';
            break;
          }
        }
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

  getSessionHistory(instanceId: string): SessionEntry[] {
    const logPath = this.getLogPath(instanceId);
    if (!fs.existsSync(logPath)) return [];

    const content = fs.readFileSync(logPath, 'utf-8');
    const sessions: SessionEntry[] = [];

    const startRegex = /--- Session started: (.+?) ---/g;
    const endRegex = /--- Session ended: (.+?) \(code=(.+?), signal=(.+?)\) ---/g;

    const starts: { time: string; index: number }[] = [];
    let match;
    while ((match = startRegex.exec(content)) !== null) {
      starts.push({ time: match[1], index: match.index });
    }

    const ends: { time: string; exitCode: string; signal: string; index: number }[] = [];
    while ((match = endRegex.exec(content)) !== null) {
      ends.push({
        time: match[1],
        exitCode: match[2],
        signal: match[3],
        index: match.index,
      });
    }

    for (const start of starts) {
      const matchingEnd = ends.find(e => e.index > start.index);
      if (matchingEnd) {
        ends.splice(ends.indexOf(matchingEnd), 1);
      }
      const exitCode = matchingEnd ? parseInt(matchingEnd.exitCode, 10) : null;
      sessions.push({
        startedAt: start.time,
        endedAt: matchingEnd?.time || null,
        exitCode: exitCode !== null && !isNaN(exitCode) ? exitCode : null,
        signal: matchingEnd ? (matchingEnd.signal === 'undefined' ? null : matchingEnd.signal) : null,
      });
    }

    return sessions;
  }
}

export const ptyManager = new PtyManager();
