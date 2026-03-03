import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { InstanceWithRuntime } from '../types';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [instances, setInstances] = useState<InstanceWithRuntime[]>([]);

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

  return {
    connected,
    instances,
    setInstances,
    socket: socketRef.current,
    refreshInstances,
  };
}
