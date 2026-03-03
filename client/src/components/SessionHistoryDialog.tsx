import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface SessionEntry {
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  signal: string | null;
}

interface SessionHistoryDialogProps {
  instanceId: string;
  instanceName: string;
  onClose: () => void;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '-';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const SessionHistoryDialog: React.FC<SessionHistoryDialogProps> = ({
  instanceId,
  instanceName,
  onClose,
}) => {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/instances/${instanceId}/sessions`)
      .then(r => r.json())
      .then(data => {
        setSessions([...data].reverse());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [instanceId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold">Session History - {instanceName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No sessions found</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, idx) => (
                <div
                  key={idx}
                  className="bg-gray-750 rounded-lg p-3 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-300">
                      Session #{sessions.length - idx}
                    </span>
                    {session.endedAt ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        session.exitCode === 0
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-amber-900/50 text-amber-400'
                      }`}>
                        exit: {session.exitCode}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400">
                        running
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>Start: {formatTime(session.startedAt)}</div>
                    {session.endedAt && (
                      <>
                        <div>End: {formatTime(session.endedAt)}</div>
                        <div>Duration: {formatDuration(session.startedAt, session.endedAt)}</div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
