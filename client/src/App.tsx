import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { KanbanBoard } from './components/KanbanBoard';
import { TerminalPanel } from './components/TerminalPanel';
import { ConfigDialog } from './components/ConfigDialog';
import { Instance, KanbanStatus } from './types';
import { Wifi, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  const { connected, instances, setInstances, socket, refreshInstances } = useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Refresh instances on mount
  useEffect(() => {
    refreshInstances();
  }, [refreshInstances]);

  const selectedInstance = instances.find(i => i.id === selectedId) || null;

  const handleStart = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/start`, { method: 'POST' });
      const data = await res.json();
      setInstances(prev => prev.map(i => i.id === id ? data : i));
    } catch (err) {
      console.error('Failed to start instance:', err);
    }
  }, [setInstances]);

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
    if (!confirm('确定删除该实例？')) return;
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
  }, [editingInstance, setInstances]);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Connection status bar */}
      <div className={`flex items-center gap-2 px-3 py-1 text-xs ${connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {connected ? '已连接' : '连接断开'}
      </div>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Kanban */}
        <div className={`flex-1 min-w-0 ${selectedInstance ? 'w-1/2' : 'w-full'}`}>
          <KanbanBoard
            instances={instances}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onStart={handleStart}
            onStop={handleStop}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onKanbanMove={handleKanbanMove}
            onCreateNew={handleCreateNew}
          />
        </div>

        {/* Right: Terminal Panel */}
        {selectedInstance && (
          <div className="w-1/2 border-l border-gray-700 flex-shrink-0">
            <TerminalPanel
              instance={selectedInstance}
              socket={socket}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      {/* Config Dialog */}
      {showConfig && (
        <ConfigDialog
          instance={editingInstance}
          onSave={handleSaveConfig}
          onClose={() => {
            setShowConfig(false);
            setEditingInstance(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
