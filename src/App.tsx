import React, { useState, useCallback } from 'react'
import { useConfigs } from './hooks/useConfigs'
import { ConfigList } from './components/ConfigList'
import { ConfigDetail } from './components/ConfigDetail'
import { ConfigDialog } from './components/ConfigDialog'
import { Instance } from './types'

const App: React.FC = () => {
  const { configs, selected, selectedId, setSelectedId, setConfigs } = useConfigs()
  const [showDialog, setShowDialog] = useState(false)
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null)

  const handleCreateNew = useCallback(() => {
    setEditingInstance(null)
    setShowDialog(true)
  }, [])

  const handleEdit = useCallback(() => {
    if (selected) {
      setEditingInstance(selected)
      setShowDialog(true)
    }
  }, [selected])

  const handleSave = useCallback(async (data: Partial<Instance>) => {
    if (editingInstance) {
      const updated = await window.electronAPI.instances.update(editingInstance.id, data)
      setConfigs(prev => prev.map(c => c.id === editingInstance.id ? updated : c))
    } else {
      const created = await window.electronAPI.instances.create(data)
      setConfigs(prev => [...prev, created])
      setSelectedId(created.id)
    }
    setShowDialog(false)
    setEditingInstance(null)
  }, [editingInstance, setConfigs, setSelectedId])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确定要删除这个配置吗？')) return
    await window.electronAPI.instances.delete(id)
    setConfigs(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId, setConfigs, setSelectedId])

  return (
    <div className="h-screen flex bg-gray-800 text-white">
      <ConfigList
        configs={configs}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreateNew={handleCreateNew}
      />
      <ConfigDetail
        config={selected}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      {showDialog && (
        <ConfigDialog
          instance={editingInstance}
          instances={configs}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditingInstance(null) }}
        />
      )}
    </div>
  )
}

export default App
