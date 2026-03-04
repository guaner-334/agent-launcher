import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import instancesRouter from './routes/instances';
import filesystemRouter from './routes/filesystem';
import { ptyManager } from './services/ptyManager';
import { store } from './services/store';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Pending auth prompts: instanceId → instance name (for tray notifications)
const pendingAuthPrompts = new Map<string, string>();
// Pending task-complete notifications: instanceId → instance name (one-shot, cleared after poll)
const pendingTaskDone = new Map<string, string>();

// Notification toggle (in-memory)
let notificationsEnabled = true;

// REST API routes
app.use('/api/instances', instancesRouter);
app.use('/api/filesystem', filesystemRouter);

// Notification settings endpoints
app.get('/api/settings/notifications', (_req, res) => {
  res.json({ enabled: notificationsEnabled });
});
app.put('/api/settings/notifications', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    notificationsEnabled = enabled;
  }
  res.json({ enabled: notificationsEnabled });
});

// Notification endpoint for tray polling
app.get('/api/notifications', (_req, res) => {
  if (!notificationsEnabled) return res.json([]);
  const authItems = Array.from(pendingAuthPrompts.entries()).map(([id, name]) => ({
    type: 'auth',
    instanceId: id,
    instanceName: name,
  }));
  const doneItems = Array.from(pendingTaskDone.entries()).map(([id, name]) => ({
    type: 'taskDone',
    instanceId: id,
    instanceName: name,
  }));
  // Task-done notifications are one-shot: clear after returning
  pendingTaskDone.clear();
  res.json([...authItems, ...doneItems]);
});

// Serve static files in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Track which instance this socket is attached to
  let attachedInstanceId: string | null = null;

  // Send current state on connection
  const instances = store.getAll();
  const withRuntime = instances.map(inst => ({
    ...inst,
    runtime: {
      processState: ptyManager.getState(inst.id),
      outputting: ptyManager.isOutputting(inst.id),
    },
  }));
  socket.emit('instances:sync', withRuntime);

  // Client attaches to an instance terminal
  socket.on('pty:attach', ({ instanceId, cols, rows }: { instanceId: string; cols: number; rows: number }) => {
    attachedInstanceId = instanceId;
    socket.join(`pty:${instanceId}`);

    // Send scrollback buffer so the client sees previous output
    const scrollback = ptyManager.getScrollback(instanceId);
    if (scrollback) {
      socket.emit('pty:scrollback', { instanceId, data: scrollback });
    }

    // Send current token stats if available
    const tokenStats = ptyManager.getTokenStats(instanceId);
    if (tokenStats) {
      socket.emit('instance:tokenStats', { instanceId, tokens: tokenStats.tokens, elapsed: tokenStats.elapsed });
    }

    // Send current user prompt if available
    const userPrompt = ptyManager.getUserPrompt(instanceId);
    if (userPrompt) {
      socket.emit('instance:userPrompt', { instanceId, prompt: userPrompt });
    }

    // Resize PTY to match client terminal
    ptyManager.resize(instanceId, cols, rows);
  });

  // Client detaches from an instance terminal
  socket.on('pty:detach', ({ instanceId }: { instanceId: string }) => {
    socket.leave(`pty:${instanceId}`);
    if (attachedInstanceId === instanceId) {
      attachedInstanceId = null;
    }
  });

  // Client sends keystrokes
  socket.on('pty:input', ({ instanceId, data }: { instanceId: string; data: string }) => {
    ptyManager.write(instanceId, data);
  });

  // Client resizes terminal
  socket.on('pty:resize', ({ instanceId, cols, rows }: { instanceId: string; cols: number; rows: number }) => {
    ptyManager.resize(instanceId, cols, rows);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // PTY stays alive in background — no cleanup needed
  });
});

// Forward PTY data to attached clients via rooms
ptyManager.onData((instanceId, event) => {
  io.to(`pty:${instanceId}`).emit('pty:data', { instanceId, data: event.data });
});

// Forward PTY exit events
ptyManager.onExit((instanceId, event) => {
  pendingAuthPrompts.delete(instanceId);
  io.emit('instance:status', { instanceId, state: 'stopped' });
  io.to(`pty:${instanceId}`).emit('pty:exit', {
    instanceId,
    exitCode: event.exitCode,
    signal: event.signal,
  });
});

// Forward auth prompt notifications
ptyManager.onAuthPrompt((instanceId) => {
  const inst = store.getAll().find(i => i.id === instanceId);
  if (inst) pendingAuthPrompts.set(instanceId, inst.name);
  io.emit('instance:authPrompt', { instanceId });
});

// Forward auth cleared (user completed the auth action)
ptyManager.onAuthCleared((instanceId) => {
  pendingAuthPrompts.delete(instanceId);
  io.emit('instance:authCleared', { instanceId });
});

// Forward task completion notifications
ptyManager.onTaskComplete((instanceId) => {
  const inst = store.getAll().find(i => i.id === instanceId);
  if (inst) pendingTaskDone.set(instanceId, inst.name);
  io.emit('instance:taskComplete', { instanceId });
});

// Forward token stats
ptyManager.onTokenStats((instanceId, stats) => {
  io.emit('instance:tokenStats', { instanceId, tokens: stats.tokens, elapsed: stats.elapsed });
});

// Forward user prompt notifications
ptyManager.onUserPrompt((instanceId, data) => {
  io.emit('instance:userPrompt', { instanceId, prompt: data.prompt });
});

// Forward output state changes
ptyManager.onOutputState((instanceId, data) => {
  io.emit('instance:outputState', { instanceId, outputting: data.outputting });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Guard against node-pty conpty agent crashes (AttachConsole failed on Windows)
// These are thrown asynchronously by child processes and cannot be caught locally.
process.on('uncaughtException', (err) => {
  const msg = err?.message || '';
  if (msg.includes('AttachConsole failed')) {
    console.warn('[PTY] Ignored conpty AttachConsole error (Windows node-pty known issue)');
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  ptyManager.stopAll();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ptyManager.stopAll();
  server.close();
  process.exit(0);
});
