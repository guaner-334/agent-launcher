import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { InstanceWithRuntime, KanbanStatus } from '../types';
import { InstanceCard } from './InstanceCard';

const COLUMN_CONFIG: Record<KanbanStatus, { title: string; color: string }> = {
  'todo': { title: 'Todo', color: 'border-gray-500' },
  'in-progress': { title: 'In Progress', color: 'border-blue-500' },
  'review': { title: 'Review', color: 'border-yellow-500' },
  'done': { title: 'Done', color: 'border-green-500' },
};

interface KanbanColumnProps {
  status: KanbanStatus;
  instances: InstanceWithRuntime[];
  selectedId: string | null;
  authPrompts: Set<string>;
  taskCompletes: Set<string>;
  tokenStats: Map<string, { tokens: number; elapsed: string }>;
  userPrompts: Map<string, string>;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onShowSessions: (id: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  instances,
  selectedId,
  authPrompts,
  taskCompletes,
  tokenStats,
  userPrompts,
  onSelect,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onShowSessions,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = COLUMN_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-0 rounded-lg bg-gray-850 ${
        isOver ? 'ring-2 ring-blue-500/50' : ''
      }`}
    >
      <div className={`flex items-center gap-2 px-3 py-2 border-b-2 ${config.color}`}>
        <h2 className="text-sm font-semibold text-gray-300">{config.title}</h2>
        <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded-full">
          {instances.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {instances.map(instance => (
          <InstanceCard
            key={instance.id}
            instance={instance}
            isSelected={instance.id === selectedId}
            hasAuthPrompt={authPrompts.has(instance.id)}
            hasTaskComplete={taskCompletes.has(instance.id)}
            tokenStats={tokenStats.get(instance.id)}
            userPrompt={userPrompts.get(instance.id)}
            onSelect={() => onSelect(instance.id)}
            onStart={() => onStart(instance.id)}
            onStop={() => onStop(instance.id)}
            onEdit={() => onEdit(instance.id)}
            onDelete={() => onDelete(instance.id)}
            onShowSessions={() => onShowSessions(instance.id)}
          />
        ))}
      </div>
    </div>
  );
};
