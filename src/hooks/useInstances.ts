import { useEffect, useState, useCallback } from 'react'
import { InstanceWithRuntime } from '../types'

export function useInstances() {
  const [instances, setInstances] = useState<InstanceWithRuntime[]>([])
  const [authPrompts, setAuthPrompts] = useState<Set<string>>(new Set())
  const [taskCompletes, setTaskCompletes] = useState<Set<string>>(new Set())
  const [tokenStats, setTokenStats] = useState<Map<string, { tokens: number; elapsed: string }>>(new Map())
  const [userPrompts, setUserPrompts] = useState<Map<string, string>>(new Map())
  const [outputting, setOutputting] = useState<Set<string>>(new Set())

  const refreshInstances = useCallback(async () => {
    try {
      const data = await window.electronAPI.instances.list()
      setInstances(data)
      const out = new Set<string>()
      data.forEach((inst: any) => {
        if (inst.runtime?.outputting) out.add(inst.id)
      })
      setOutputting(out)
    } catch (err) {
      console.error('Failed to refresh instances:', err)
    }
  }, [])

  useEffect(() => {
    refreshInstances()

    const cleanups: (() => void)[] = []

    cleanups.push(window.electronAPI.on('instance:status-changed', ({ instanceId, state }) => {
      setInstances(prev => prev.map(inst =>
        inst.id === instanceId
          ? { ...inst, runtime: { ...inst.runtime, processState: state } }
          : inst
      ))
    }))

    cleanups.push(window.electronAPI.on('instance:auth-prompt', ({ instanceId }) => {
      setAuthPrompts(prev => new Set(prev).add(instanceId))
    }))

    cleanups.push(window.electronAPI.on('instance:auth-cleared', ({ instanceId }) => {
      setAuthPrompts(prev => {
        const next = new Set(prev)
        next.delete(instanceId)
        return next
      })
    }))

    cleanups.push(window.electronAPI.on('instance:task-complete', ({ instanceId }) => {
      setTaskCompletes(prev => new Set(prev).add(instanceId))
    }))

    cleanups.push(window.electronAPI.on('instance:token-stats', ({ instanceId, tokens, elapsed }) => {
      setTokenStats(prev => {
        const next = new Map(prev)
        next.set(instanceId, { tokens, elapsed })
        return next
      })
    }))

    cleanups.push(window.electronAPI.on('instance:output-state', ({ instanceId, outputting: isOutputting }) => {
      setOutputting(prev => {
        const next = new Set(prev)
        if (isOutputting) next.add(instanceId)
        else next.delete(instanceId)
        return next
      })
    }))

    cleanups.push(window.electronAPI.on('instance:user-prompt', ({ instanceId, prompt }) => {
      setUserPrompts(prev => {
        const next = new Map(prev)
        next.set(instanceId, prompt)
        return next
      })
    }))

    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [refreshInstances])

  const clearTaskComplete = useCallback((id: string) => {
    setTaskCompletes(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  return {
    instances,
    setInstances,
    refreshInstances,
    authPrompts,
    taskCompletes,
    tokenStats,
    userPrompts,
    outputting,
    clearTaskComplete,
  }
}
