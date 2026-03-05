import React, { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { InstanceWithRuntime, KanbanStatus } from '../types'
import { InstanceCard } from './InstanceCard'

const COLUMN_CONFIG: Record<KanbanStatus, { title: string; color: string }> = {
  'todo': { title: 'Todo', color: 'border-gray-500' },
  'in-progress': { title: 'In Progress', color: 'border-blue-500' },
  'review': { title: 'Review', color: 'border-yellow-500' },
  'done': { title: 'Done', color: 'border-green-500' },
}

interface KanbanColumnProps {
  status: KanbanStatus
  customTitle?: string
  instances: InstanceWithRuntime[]
  authPrompts: Set<string>
  taskCompletes: Set<string>
  tokenStats: Map<string, { tokens: number; elapsed: string }>
  userPrompts: Map<string, string>
  outputting: Set<string>
  startingIds: Set<string>
  onSelect: (id: string) => void
  onStart: (id: string) => void
  onStop: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onShowSessions: (id: string) => void
  onRenameColumn?: (status: KanbanStatus, newTitle: string) => void
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  customTitle,
  instances,
  authPrompts,
  taskCompletes,
  tokenStats,
  userPrompts,
  outputting,
  startingIds,
  onSelect,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onShowSessions,
  onRenameColumn,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = COLUMN_CONFIG[status]
  const title = customTitle || config.title

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleDoubleClick = () => {
    setEditValue(title)
    setEditing(true)
  }

  const handleSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title && onRenameColumn) {
      onRenameColumn(status, trimmed)
    }
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-0 rounded-lg bg-gray-850 ${isOver ? 'ring-2 ring-blue-500/50' : ''}`}
    >
      <div className={`flex items-center gap-2 px-3 py-2 border-b-2 ${config.color}`}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="text-sm font-semibold text-gray-300 bg-gray-700 rounded px-1 py-0 outline-none border border-gray-600 w-full"
          />
        ) : (
          <h2
            className="text-sm font-semibold text-gray-300 cursor-pointer hover:text-gray-100"
            onDoubleClick={handleDoubleClick}
            title="双击编辑列名"
          >
            {title}
          </h2>
        )}
        <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
          {instances.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {instances.map(instance => (
          <InstanceCard
            key={instance.id}
            instance={instance}
            hasAuthPrompt={authPrompts.has(instance.id)}
            hasTaskComplete={taskCompletes.has(instance.id)}
            tokenStats={tokenStats.get(instance.id)}
            userPrompt={userPrompts.get(instance.id)}
            isOutputting={outputting.has(instance.id)}
            isStarting={startingIds.has(instance.id)}
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
  )
}
