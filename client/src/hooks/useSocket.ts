import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { InstanceWithRuntime } from '../types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [instances, setInstances] = useState<InstanceWithRuntime[]>([]);
  const [authPrompts, setAuthPrompts] = useState<Set<string>>(new Set());
  const [taskCompletes, setTaskCompletes] = useState<Set<string>>(new Set());
  const [tokenStats, setTokenStats] = useState<Map<string, { tokens: number; elapsed: string }>>(new Map());

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    // Initial sync
    socket.on('instances:sync', (data: InstanceWithRuntime[]) => {
      setInstances(data);
    });

    // Instance status updates
    socket.on('instance:status', ({ instanceId, state }: { instanceId: string; state: string }) => {
      setInstances(prev => prev.map(inst =>
        inst.id === instanceId
          ? { ...inst, runtime: { ...inst.runtime, processState: state as any } }
          : inst
      ));
    });

    // Error notifications
    socket.on('instance:error', ({ instanceId, error }: { instanceId: string; error: string }) => {
      console.error(`Instance ${instanceId} error:`, error);
      setInstances(prev => prev.map(inst =>
        inst.id === instanceId
          ? { ...inst, runtime: { ...inst.runtime, processState: 'stopped' as any } }
          : inst
      ));
    });

    // Auth prompt notifications
    socket.on('instance:authPrompt', ({ instanceId }: { instanceId: string }) => {
      setAuthPrompts(prev => new Set(prev).add(instanceId));
    });

    // Task completion notifications
    socket.on('instance:taskComplete', ({ instanceId }: { instanceId: string }) => {
      setTaskCompletes(prev => new Set(prev).add(instanceId));
    });

    // Token stats updates
    socket.on('instance:tokenStats', ({ instanceId, tokens, elapsed }: { instanceId: string; tokens: number; elapsed: string }) => {
      setTokenStats(prev => {
        const next = new Map(prev);
        next.set(instanceId, { tokens, elapsed });
        return next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const refreshInstances = useCallback(async () => {
    try {
      const res = await fetch('/api/instances');
      const data = await res.json();
      setInstances(data);
    } catch (err) {
      console.error('Failed to refresh instances:', err);
    }
  }, []);

  const clearAuthPrompt = useCallback((id: string) => {
    setAuthPrompts(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearTaskComplete = useCallback((id: string) => {
    setTaskCompletes(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    connected,
    instances,
    setInstances,
    socket: socketRef.current,
    refreshInstances,
    authPrompts,
    taskCompletes,
    tokenStats,
    clearAuthPrompt,
    clearTaskComplete,
  };
}
