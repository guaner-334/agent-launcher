import React, { useEffect, useState, useRef, useCallback } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { SessionEntry } from '../types'

interface SessionHistoryDialogProps {
  instanceId: string
  instanceName: string
  onClose: () => void
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '-'
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export const SessionHistoryDialog: React.FC<SessionHistoryDialogProps> = ({
  instanceId,
  instanceName,
  onClose,
}) => {
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)
  const [contentLoading, setContentLoading] = useState(false)

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    window.electronAPI.instances.getSessions(instanceId)
      .then(data => {
        setSessions([...data].reverse())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [instanceId])

  const openSession = useCallback((originalIndex: number) => {
    setViewingIndex(originalIndex)
    setContentLoading(true)
  }, [])

  const closeViewer = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
    setViewingIndex(null)
  }, [])

  useEffect(() => {
    if (viewingIndex === null) return

    const timer = requestAnimationFrame(() => {
      if (!terminalRef.current) return

      const term = new Terminal({
        cursorBlink: false,
        fontSize: 13,
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        theme: {
          background: '#1a1b26',
          foreground: '#a9b1d6',
          cursor: '#1a1b26',
          selectionBackground: '#33467c',
        },
        scrollback: 50000,
        convertEol: false,
        disableStdin: true,
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.open(terminalRef.current)

      requestAnimationFrame(() => fitAddon.fit())

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      window.electronAPI.instances.getSessionContent(instanceId, viewingIndex)
        .then(content => {
          if (!content) {
            term.write('\x1b[31mSession content not found.\x1b[0m\r\n')
            setContentLoading(false)
            return
          }
          const CHUNK = 64 * 1024
          let offset = 0
          const writeChunk = () => {
            if (offset >= content.length) {
              setContentLoading(false)
              return
            }
            term.write(content.slice(offset, offset + CHUNK), () => {
              offset += CHUNK
              requestAnimationFrame(writeChunk)
            })
          }
          writeChunk()
        })
        .catch(() => {
          term.write('\x1b[31mFailed to load session content.\x1b[0m\r\n')
          setContentLoading(false)
        })
    })

    const container = terminalRef.current
    let resizeObserver: ResizeObserver | null = null
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => fitAddonRef.current?.fit())
      })
      resizeObserver.observe(container)
    }

    return () => {
      cancelAnimationFrame(timer)
      resizeObserver?.disconnect()
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }
  }, [viewingIndex, instanceId])

  if (viewingIndex !== null) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div
          className="bg-gray-800 rounded-xl shadow-2xl flex flex-col"
          style={{ width: '50vw', height: '80vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={closeViewer}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-sm font-semibold">
                {instanceName} - Session #{viewingIndex + 1}
              </h2>
              {contentLoading && <span className="text-xs text-gray-500">Loading...</span>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div ref={terminalRef} className="flex-1 min-h-0 p-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold">会话历史 - {instanceName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">加载中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无会话记录</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session, idx) => {
                const originalIndex = sessions.length - 1 - idx
                return (
                  <div
                    key={idx}
                    className="bg-gray-750 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-gray-500 transition-colors"
                    onClick={() => openSession(originalIndex)}
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
