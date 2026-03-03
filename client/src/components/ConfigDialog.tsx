import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Instance } from '../types';

interface ConfigDialogProps {
  instance?: Instance | null;
  onSave: (data: Partial<Instance>) => void;
  onClose: () => void;
}

export const ConfigDialog: React.FC<ConfigDialogProps> = ({ instance, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '',
    workingDirectory: '',
    apiBaseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: '',
    permissionMode: 'bypassPermissions',
    claudeConfigDir: '',
  });
  const [envEntries, setEnvEntries] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (instance) {
      setForm({
        name: instance.name || '',
        workingDirectory: instance.workingDirectory || '',
        apiBaseUrl: instance.apiBaseUrl || '',
        apiKey: instance.apiKey || '',
        model: instance.model || '',
        systemPrompt: instance.systemPrompt || '',
        permissionMode: instance.permissionMode || 'bypassPermissions',
        claudeConfigDir: instance.claudeConfigDir || '',
      });
      setEnvEntries(
        instance.env
          ? Object.entries(instance.env).map(([key, value]) => ({ key, value }))
          : []
      );
    }
  }, [instance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const env: Record<string, string> = {};
    for (const { key, value } of envEntries) {
      if (key.trim()) env[key.trim()] = value;
    }
    onSave({
      name: form.name,
      workingDirectory: form.workingDirectory,
      apiBaseUrl: form.apiBaseUrl || undefined,
      apiKey: form.apiKey || undefined,
      model: form.model || undefined,
      systemPrompt: form.systemPrompt || undefined,
      permissionMode: form.permissionMode,
      claudeConfigDir: form.claudeConfigDir || undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
    });
  };

  const addEnvEntry = () => setEnvEntries(e => [...e, { key: '', value: '' }]);
  const removeEnvEntry = (i: number) => setEnvEntries(e => e.filter((_, idx) => idx !== i));
  const updateEnvEntry = (i: number, field: 'key' | 'value', val: string) =>
    setEnvEntries(e => e.map((entry, idx) => idx === i ? { ...entry, [field]: val } : entry));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">
            {instance ? '编辑实例' : '创建实例'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="例如: 前端开发助手"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">工作目录 *</label>
            <input
              type="text"
              value={form.workingDirectory}
              onChange={e => setForm(f => ({ ...f, workingDirectory: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              placeholder="例如: C:\Users\xxx\project"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">API Base URL</label>
            <input
              type="text"
              value={form.apiBaseUrl}
              onChange={e => setForm(f => ({ ...f, apiBaseUrl: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="留空使用默认 Anthropic API"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="留空使用环境变量"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">模型</label>
            <input
              type="text"
              value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例如: claude-sonnet-4-20250514"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">System Prompt</label>
            <textarea
              value={form.systemPrompt}
              onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              placeholder="自定义系统提示（可选）"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">权限模式</label>
            <select
              value={form.permissionMode}
              onChange={e => setForm(f => ({ ...f, permissionMode: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bypassPermissions">bypassPermissions (自动批准)</option>
              <option value="default">default (终端内确认)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Claude 配置目录</label>
            <input
              type="text"
              value={form.claudeConfigDir}
              onChange={e => setForm(f => ({ ...f, claudeConfigDir: e.target.value }))}
              className="w-full bg-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="留空自动隔离（设置了 API Base URL 时自动创建）"
            />
            <p className="text-xs text-gray-500 mt-1">
              {form.apiBaseUrl
                ? '已设置自定义 API 地址，启动时将自动创建隔离配置目录（无需 CC-Switch 全局切换）'
                : '设置 CLAUDE_CONFIG_DIR，手动指定独立的 Claude 配置目录'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-400">自定义环境变量</label>
              <button
                type="button"
                onClick={addEnvEntry}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Plus size={12} /> 添加
              </button>
            </div>
            {envEntries.length === 0 && (
              <p className="text-xs text-gray-500">无自定义环境变量</p>
            )}
            <div className="space-y-2">
              {envEntries.map((entry, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={entry.key}
                    onChange={e => updateEnvEntry(i, 'key', e.target.value)}
                    className="flex-1 bg-gray-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="变量名"
                  />
                  <span className="text-gray-500 text-xs">=</span>
                  <input
                    type="text"
                    value={entry.value}
                    onChange={e => updateEnvEntry(i, 'value', e.target.value)}
                    className="flex-1 bg-gray-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="值"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvEntry(i)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded font-medium"
            >
              {instance ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

