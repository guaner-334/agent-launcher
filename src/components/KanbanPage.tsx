import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useInstances } from '../hooks/useInstances'
import { KanbanBoard } from './KanbanBoard'
import { ConfigDialog } from './ConfigDialog'
import { SessionHistoryDialog } from './SessionHistoryDialog'
import { Instance, KanbanStatus } from '../types'
import { Bell, BellOff } from 'lucide-react'

export const KanbanPage: React.FC = () => {
  const {
    instances, setInstances, refreshInstances,
    authPrompts, taskCompletes, tokenStats, userPrompts, outputting, clearTaskComplete,
  } = useInstances()

  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [sessionHistoryId, setSessionHistoryId] = useState<string | null>(null)
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set())
  const startingIdsRef = useRef<Set<string>>(new Set())
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  useEffect(() => {
    window.electronAPI.settings.getNotifications().then(setNotificationsEnabled).catch(() => {})
  }, [])

  const handleStart = useCallback(async (id: string) => {
    if (startingIdsRef.current.has(id)) return
    startingIdsRef.current.add(id)
    setStartingIds(new Set(startingIdsRef.current))
    try {
      const data = await window.electronAPI.instances.start(id)
      setInstances(prev => prev.map(i => i.id === id ? data : i))
      clearTaskComplete(id)
    } catch (err: any) {
      alert(err.message || '启动失败')
    } finally {
      startingIdsRef.current.delete(id)
      setStartingIds(new Set(startingIdsRef.current))
    }
  }, [setInstances, clearTaskComplete])

  const handleStop = useCallback(async (id: string) => {
    try {
      const data = await window.electronAPI.instances.stop(id)
      setInstances(prev => prev.map(i => i.id === id ? data : i))
    } catch (err) {
      console.error('Failed to stop instance:', err)
    }
  }, [setInstances])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确认删除此实例？')) return
    try {
      await window.electronAPI.instances.delete(id)
      setInstances(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error('Failed to delete instance:', err)
    }
  }, [setInstances])

  const handleKanbanMove = useCallback(async (instanceId: string, newStatus: KanbanStatus) => {
    try {
      const data = await window.electronAPI.instances.moveKanban(instanceId, newStatus)
      setInstances(prev => prev.map(i => i.id === instanceId ? data : i))
    } catch (err) {
      console.error('Failed to move instance:', err)
    }
  }, [setInstances])

  const handleSaveConfig = useCallback(async (data: Partial<Instance>) => {
    try {
      if (editingInstance) {
        const updated = await window.electronAPI.instances.update(editingInstance.id, data)
        setInstances(prev => prev.map(i => i.id === editingInstance.id ? updated : i))

        const inst = instances.find(i => i.id === editingInstance.id)
        if (inst && inst.runtime.processState === 'running') {
          if (confirm('设置已更新。是否重启实例使配置生效？')) {
            await window.electronAPI.instances.stop(editingInstance.id)
            await new Promise(r => setTimeout(r, 500))
            const startedData = await window.electronAPI.instances.start(editingInstance.id)
            setInstances(prev => prev.map(i => i.id === editingInstance.id ? startedData : i))
          }
        }
      } else {
        const created = await window.electronAPI.instances.create(data)
        setInstances(prev => [...prev, created])
      }
      setShowConfig(false)
      setEditingInstance(null)
    } catch (err) {
      console.error('Failed to save instance:', err)
    }
  }, [editingInstance, setInstances, instances])

  const handleEdit = useCallback((id: string) => {
    const instance = instances.find(i => i.id === id)
    if (instance) {
      setEditingInstance(instance)
      setShowConfig(true)
    }
  }, [instances])

  const handleCreateNew = useCallback(() => {
    setEditingInstance(null)
    setShowConfig(true)
  }, [])

  const handleShowSessions = useCallback((id: string) => {
    setSessionHistoryId(id)
  }, [])

  const handleOpenTerminal = useCallback(async (id: string) => {
    try {
      await window.electronAPI.instances.openTerminal(id)
    } catch (err) {
      console.error('Failed to open terminal:', err)
    }
  }, [])

  const toggleNotifications = useCallback(async () => {
    const newVal = !notificationsEnabled
    setNotificationsEnabled(newVal)
    try {
      await window.electronAPI.settings.setNotifications(newVal)
    } catch {
      setNotificationsEnabled(!newVal)
    }
  }, [notificationsEnabled])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs bg-gray-800/50 text-gray-400 border-b border-gray-700">
        <span>AgentManager v2.0</span>
        <button
          onClick={toggleNotifications}
          className="flex items-center gap-1 hover:opacity-70 transition-opacity"
          title={notificationsEnabled ? '关闭通知' : '开启通知'}
        >
          {notificationsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
        </button>
      </div>

      {/* Kanban */}
      <div className="flex-1 min-h-0">
        <KanbanBoard
          instances={instances}
          authPrompts={authPrompts}
          taskCompletes={taskCompletes}
          tokenStats={tokenStats}
          userPrompts={userPrompts}
          outputting={outputting}
          startingIds={startingIds}
          onSelect={handleOpenTerminal}
          onStart={handleStart}
          onStop={handleStop}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onKanbanMove={handleKanbanMove}
          onCreateNew={handleCreateNew}
          onShowSessions={handleShowSessions}
        />
      </div>

      {/* Dialogs */}
      {showConfig && (
        <ConfigDialog
          instance={editingInstance}
          instances={instances}
          onSave={handleSaveConfig}
          onClose={() => { setShowConfig(false); setEditingInstance(null) }}
        />
      )}

      {sessionHistoryId && (() => {
        const inst = instances.find(i => i.id === sessionHistoryId)
        return inst ? (
          <SessionHistoryDialog
            instanceId={sessionHistoryId}
            instanceName={inst.name}
            onClose={() => setSessionHistoryId(null)}
          />
        ) : null
      })()}
    </div>
  )
}
