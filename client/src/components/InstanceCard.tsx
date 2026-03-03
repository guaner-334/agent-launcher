import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Play, Square, Settings, Trash2, FolderOpen, GripVertical, Globe, History, ShieldAlert, CheckCircle, ArrowDown } from 'lucide-react';
import { InstanceWithRuntime } from '../types';
import { StatusBadge } from './StatusBadge';

interface InstanceCardProps {
  instance: InstanceWithRuntime;
  isSelected: boolean;
  hasAuthPrompt?: boolean;
  hasTaskComplete?: boolean;
  tokenStats?: { tokens: number; elapsed: string };
  userPrompt?: string;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowSessions: () => void;
}

export const InstanceCard: React.FC<InstanceCardProps> = ({
  instance,
  isSelected,
  hasAuthPrompt,
  hasTaskComplete,
  tokenStats,
  userPrompt,
  onSelect,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onShowSessions,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: instance.id,
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
  };

  const isRunning = instance.runtime.processState === 'running';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800 rounded-lg p-3 cursor-pointer border transition-colors ${
        isSelected
          ? 'border-blue-500 shadow-lg shadow-blue-500/10'
          : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 flex-shrink-0"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
          <h3 className="font-medium text-sm truncate">{instance.name}</h3>
        </div>
        <StatusBadge state={instance.runtime.processState} />
        {hasAuthPrompt && (
          <span className="flex-shrink-0 text-amber-400 animate-pulse" title="Needs approval">
            <ShieldAlert size={14} />
          </span>
        )}
        {hasTaskComplete && (
          <span className="flex-shrink-0 text-green-400" title="Task completed">
            <CheckCircle size={14} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <FolderOpen size={12} />
        <span className="truncate">{instance.workingDirectory}</span>
      </div>

      {instance.apiBaseUrl && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Globe size={12} />
          <span className="truncate">{instance.apiBaseUrl}</span>
        </div>
      )}

      {instance.model && (
        <div className="text-xs text-gray-500 mb-3 truncate">
          模型: {instance.model}
        </div>
      )}

      {tokenStats && (
        <div className="flex items-center gap-1 text-xs text-cyan-400 mb-3">
          <ArrowDown size={12} />
          <span>{tokenStats.tokens.toLocaleString()} tokens · {tokenStats.elapsed}</span>
        </div>
      )}

      {userPrompt && (
        <div className="text-xs text-gray-500 mb-3 truncate" title={userPrompt}>
          <span className="text-gray-600">&#10095;</span> {userPrompt}
        </div>
      )}

      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {!isRunning ? (
          <button
            onClick={onStart}
            className="p-1.5 rounded hover:bg-gray-700 text-green-400 hover:text-green-300"
            title="启动"
          >
            <Play size={14} />
          </button>
        ) : (
          <button
            onClick={onStop}
            className="p-1.5 rounded hover:bg-gray-700 text-yellow-400 hover:text-yellow-300"
            title="停止"
          >
            <Square size={14} />
          </button>
        )}
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Settings"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={onShowSessions}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Session history"
        >
          <History size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
