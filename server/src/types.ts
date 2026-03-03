export interface Instance {
  id: string;
  name: string;
  apiBaseUrl?: string;
  apiKey?: string;
  workingDirectory: string;
  model?: string;
  systemPrompt?: string;
  permissionMode?: string;
  claudeConfigDir?: string;
  env?: Record<string, string>;
  kanbanStatus: 'todo' | 'in-progress' | 'review' | 'done';
  createdAt: string;
  updatedAt: string;
}

export interface InstanceRuntime {
  processState: 'idle' | 'running' | 'stopped';
}

export interface InstanceWithRuntime extends Instance {
  runtime: InstanceRuntime;
}

export interface SessionEntry {
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
}
