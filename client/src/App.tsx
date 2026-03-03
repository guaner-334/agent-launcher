import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { KanbanBoard } from './components/KanbanBoard';
import { TerminalPanel } from './components/TerminalPanel';
import { WelcomePanel } from './components/WelcomePanel';
import { ConfigDialog } from './components/ConfigDialog';
import { SessionHistoryDialog } from './components/SessionHistoryDialog';
import { Instance, KanbanStatus } from './types';
import { Wifi, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  const {
    connected, instances, setInstances, socket, refreshInstances,
    authPrompts, taskCompletes, tokenStats, userPrompts, clearAuthPrompt, clearTaskComplete,
  } = useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sessionHistoryId, setSessionHistoryId] = useState<string | null>(null);

  // Refresh instances on mount
  useEffect(() => {
    refreshInstances();
  }, [refreshInstances]);

  const selectedInstance = instances.find(i => i.id === selectedId) || null;

  // Unified select handler: clears notifications
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    clearAuthPrompt(id);
    clearTaskComplete(id);
  }, [clearAuthPrompt, clearTaskComplete]);

  const handleStart = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/start`, { method: 'POST' });
      const data = await res.json();
      setInstances(prev => prev.map(i => i.id === id ? data : i));
      // Auto-select on start
      setSelectedId(id);
      clearAuthPrompt(id);
      clearTaskComplete(id);
    } catch (err) {
      console.error('Failed to start instance:', err);
    }
  }, [setInstances, clearAuthPrompt, clearTaskComplete]);

  const handleStop = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/stop`, { method: 'POST' });
      const data = await res.json();
      setInstances(prev => prev.map(i => i.id === id ? data : i));
    } catch (err) {
      console.error('Failed to stop instance:', err);
    }
  }, [setInstances]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this instance?')) return;
    try {
      await fetch(`/api/instances/${id}`, { method: 'DELETE' });
      setInstances(prev => prev.filter(i => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error('Failed to delete instance:', err);
    }
  }, [selectedId, setInstances]);

  const handleKanbanMove = useCallback(async (instanceId: string, newStatus: KanbanStatus) => {
    try {
      const res = await fetch(`/api/instances/${instanceId}/kanban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanbanStatus: newStatus }),
      });
      const data = await res.json();
      setInstances(prev => prev.map(i => i.id === instanceId ? data : i));
    } catch (err) {
      console.error('Failed to move instance:', err);
    }
  }, [setInstances]);

  const handleSaveConfig = useCallback(async (data: Partial<Instance>) => {
    try {
      if (editingInstance) {
        // Update
        const res = await fetch(`/api/instances/${editingInstance.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const updated = await res.json();
        setInstances(prev => prev.map(i => i.id === editingInstance.id ? updated : i));

        // If instance is running, prompt user to restart
        const inst = instances.find(i => i.id === editingInstance.id);
        if (inst && inst.runtime.processState === 'running') {
          if (confirm('设置已更新。是否重启实例使配置生效？')) {
            await fetch(`/api/instances/${editingInstance.id}/stop`, { method: 'POST' });
            await new Promise(r => setTimeout(r, 500));
            const startRes = await fetch(`/api/instances/${editingInstance.id}/start`, { method: 'POST' });
            const startedData = await startRes.json();
            setInstances(prev => prev.map(i => i.id === editingInstance.id ? startedData : i));
          }
        }
      } else {
        // Create
        const res = await fetch('/api/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const created = await res.json();
        setInstances(prev => [...prev, created]);
      }
      setShowConfig(false);
      setEditingInstance(null);
    } catch (err) {
      console.error('Failed to save instance:', err);
    }
  }, [editingInstance, setInstances, instances]);

  const handleEdit = useCallback((id: string) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
      setEditingInstance(instance);
      setShowConfig(true);
    }
  }, [instances]);

  const handleCreateNew = useCallback(() => {
    setEditingInstance(null);
    setShowConfig(true);
  }, []);

  const handleShowSessions = useCallback((id: string) => {
    setSessionHistoryId(id);
  }, []);

  // Don't show task complete badge for the currently selected instance
  const effectiveTaskCompletes = new Set(taskCompletes);
  if (selectedId) effectiveTaskCompletes.delete(selectedId);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Connection status bar */}
      <div className={`flex items-center gap-2 px-3 py-1 text-xs ${connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {connected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Kanban */}
        <div className="flex-1 min-w-0">
          <KanbanBoard
            instances={instances}
            selectedId={selectedId}
            authPrompts={authPrompts}
            taskCompletes={effectiveTaskCompletes}
            tokenStats={tokenStats}
            userPrompts={userPrompts}
            onSelect={handleSelect}
            onStart={handleStart}
            onStop={handleStop}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onKanbanMove={handleKanbanMove}
            onCreateNew={handleCreateNew}
            onShowSessions={handleShowSessions}
          />
        </div>

        {/* Right: Terminal Panel or Welcome */}
        <div className="w-1/2 border-l border-gray-700 flex-shrink-0">
          {selectedInstance ? (
            <TerminalPanel
              instance={selectedInstance}
              socket={socket}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <WelcomePanel />
          )}
        </div>
      </div>

      {/* Config Dialog */}
      {showConfig && (
        <ConfigDialog
          instance={editingInstance}
          instances={instances}
          onSave={handleSaveConfig}
          onClose={() => {
            setShowConfig(false);
            setEditingInstance(null);
          }}
        />
      )}

      {/* Session History Dialog */}
      {sessionHistoryId && (() => {
        const inst = instances.find(i => i.id === sessionHistoryId);
        return inst ? (
          <SessionHistoryDialog
            instanceId={sessionHistoryId}
            instanceName={inst.name}
            onClose={() => setSessionHistoryId(null)}
          />
        ) : null;
      })()}
    </div>
  );
};

export default App;
