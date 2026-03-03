import React from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { InstanceWithRuntime, KanbanStatus } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { Plus, GripVertical, Play, Square, Settings, Trash2, FolderOpen, Globe, History } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

const COLUMNS: KanbanStatus[] = ['todo', 'in-progress', 'review', 'done'];

interface KanbanBoardProps {
  instances: InstanceWithRuntime[];
  selectedId: string | null;
  authPrompts: Set<string>;
  taskCompletes: Set<string>;
  tokenStats: Map<string, { tokens: number; elapsed: string }>;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onKanbanMove: (instanceId: string, newStatus: KanbanStatus) => void;
  onCreateNew: () => void;
  onShowSessions: (id: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  instances,
  selectedId,
  authPrompts,
  taskCompletes,
  tokenStats,
  onSelect,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onKanbanMove,
  onCreateNew,
  onShowSessions,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const instanceId = active.id as string;
    const newStatus = over.id as KanbanStatus;

    // Only move if dropping onto a column
    if (COLUMNS.includes(newStatus)) {
      const instance = instances.find(i => i.id === instanceId);
      if (instance && instance.kanbanStatus !== newStatus) {
        onKanbanMove(instanceId, newStatus);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h1 className="text-lg font-bold">AgentManager</h1>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus size={16} />
          新建实例
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 grid grid-cols-4 gap-3 p-4 min-h-0 overflow-hidden">
          {COLUMNS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              instances={instances.filter(i => i.kanbanStatus === status)}
              selectedId={selectedId}
              authPrompts={authPrompts}
              taskCompletes={taskCompletes}
              tokenStats={tokenStats}
              onSelect={onSelect}
              onStart={onStart}
              onStop={onStop}
              onEdit={onEdit}
              onDelete={onDelete}
              onShowSessions={onShowSessions}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeId ? (() => {
            const inst = instances.find(i => i.id === activeId);
            if (!inst) return null;
            const isRunning = inst.runtime.processState === 'running';
            return (
              <div className="bg-gray-800 rounded-lg p-3 border border-blue-500 shadow-lg shadow-blue-500/20 w-[260px] opacity-90">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-gray-500 flex-shrink-0">
                      <GripVertical size={14} />
                    </span>
                    <h3 className="font-medium text-sm truncate">{inst.name}</h3>
                  </div>
                  <StatusBadge state={inst.runtime.processState} />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  <FolderOpen size={12} />
                  <span className="truncate">{inst.workingDirectory}</span>
                </div>
                {inst.apiBaseUrl && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <Globe size={12} />
                    <span className="truncate">{inst.apiBaseUrl}</span>
                  </div>
                )}
                {inst.model && (
                  <div className="text-xs text-gray-500 mb-3 truncate">
                    模型: {inst.model}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {!isRunning ? (
                    <span className="p-1.5 text-green-400"><Play size={14} /></span>
                  ) : (
                    <span className="p-1.5 text-yellow-400"><Square size={14} /></span>
                  )}
                  <span className="p-1.5 text-gray-400"><Settings size={14} /></span>
                  <span className="p-1.5 text-gray-400"><Trash2 size={14} /></span>
                </div>
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
