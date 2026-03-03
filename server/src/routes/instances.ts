import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { store } from '../services/store';
import { ptyManager } from '../services/ptyManager';
import { removeIsolatedConfig } from '../services/configIsolation';
import { Instance, InstanceWithRuntime } from '../types';

const router = Router();

// Helper: attach runtime to instance
function withRuntime(inst: Instance): InstanceWithRuntime {
  return {
    ...inst,
    runtime: { processState: ptyManager.getState(inst.id) },
  };
}

// GET /api/instances - 获取所有实例（含运行时状态）
router.get('/', (req, res) => {
  const instances = store.getAll();
  res.json(instances.map(withRuntime));
});

// POST /api/instances - 创建实例
router.post('/', (req, res) => {
  const { name, apiBaseUrl, apiKey, workingDirectory, model, systemPrompt, permissionMode, kanbanStatus } = req.body;

  if (!name || !workingDirectory) {
    return res.status(400).json({ error: 'name and workingDirectory are required' });
  }

  const instance: Instance = {
    id: uuidv4(),
    name,
    apiBaseUrl: apiBaseUrl || undefined,
    apiKey: apiKey || undefined,
    workingDirectory,
    model: model || undefined,
    systemPrompt: systemPrompt || undefined,
    permissionMode: permissionMode || 'bypassPermissions',
    kanbanStatus: kanbanStatus || 'todo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.create(instance);
  res.status(201).json(withRuntime(instance));
});

// PUT /api/instances/:id - 更新实例配置
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = store.getById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  const updates: Partial<Instance> = {};
  const allowedFields = ['name', 'apiBaseUrl', 'apiKey', 'workingDirectory', 'model', 'systemPrompt', 'permissionMode', 'kanbanStatus'];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      (updates as any)[field] = req.body[field];
    }
  }

  const updated = store.update(id, updates);
  if (!updated) {
    return res.status(500).json({ error: 'Failed to update instance' });
  }

  res.json(withRuntime(updated));
});

// DELETE /api/instances/:id - 删除实例
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Stop PTY if running
  if (ptyManager.isRunning(id)) {
    ptyManager.stopInstance(id);
  }

  // Delete log file
  ptyManager.deleteLog(id);

  // Clean up auto-generated isolated config directory
  removeIsolatedConfig(id);

  const deleted = store.delete(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  res.json({ success: true });
});

// POST /api/instances/:id/start - 启动实例进程
router.post('/:id/start', (req, res) => {
  const { id } = req.params;
  const instance = store.getById(id);
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  const success = ptyManager.startInstance(instance);
  if (!success) {
    return res.status(500).json({ error: 'Failed to start instance. Check working directory.' });
  }

  res.json(withRuntime(instance));
});

// POST /api/instances/:id/stop - 停止实例进程
router.post('/:id/stop', (req, res) => {
  const { id } = req.params;
  const instance = store.getById(id);
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  ptyManager.stopInstance(id);
  res.json(withRuntime(instance));
});

// PUT /api/instances/:id/kanban - 更新看板状态
router.put('/:id/kanban', (req, res) => {
  const { id } = req.params;
  const { kanbanStatus } = req.body;

  if (!['todo', 'in-progress', 'review', 'done'].includes(kanbanStatus)) {
    return res.status(400).json({ error: 'Invalid kanban status' });
  }

  const updated = store.update(id, { kanbanStatus });
  if (!updated) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  res.json(withRuntime(updated));
});

// GET /api/instances/:id/log - 下载终端日志
router.get('/:id/log', (req, res) => {
  const { id } = req.params;
  const logPath = ptyManager.getLogPath(id);

  if (!fs.existsSync(logPath)) {
    return res.status(404).json({ error: 'No log file found' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${id}.log"`);
  fs.createReadStream(logPath).pipe(res);
});

// DELETE /api/instances/:id/log - 删除终端日志
router.delete('/:id/log', (req, res) => {
  const { id } = req.params;
  ptyManager.deleteLog(id);
  res.json({ success: true });
});

export default router;
