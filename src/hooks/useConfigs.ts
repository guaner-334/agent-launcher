import { useState, useEffect, useCallback } from 'react'
import { Instance } from '../types'

export function useConfigs() {
  const [configs, setConfigs] = useState<Instance[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const data = await window.electronAPI.instances.list()
    setConfigs(data)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const selected = configs.find(c => c.id === selectedId) || null

  return { configs, selected, selectedId, setSelectedId, refresh, setConfigs }
}
