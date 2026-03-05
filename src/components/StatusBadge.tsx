import React from 'react'

interface StatusBadgeProps {
  state: string
  outputting?: boolean
  hasAuthPrompt?: boolean
  hasTaskComplete?: boolean
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: 'bg-gray-500', label: '空闲' },
  running: { color: 'bg-green-500', label: '运行中' },
  stopped: { color: 'bg-yellow-500', label: '已停止' },
  error: { color: 'bg-red-500', label: '错误' },
}

const WORKING_TEXT = '正在工作'

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, outputting, hasAuthPrompt, hasTaskComplete }) => {
  const isRunning = state === 'running'
  const isOutputting = isRunning && outputting
  const isAuthPrompt = isRunning && !outputting && hasAuthPrompt
  const isTaskComplete = isRunning && !outputting && hasTaskComplete
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.idle

  if (isOutputting) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="inline-flex text-green-400">
          {[...WORKING_TEXT].map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                animation: `wave-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            >
              {ch}
            </span>
          ))}
        </span>
      </span>
    )
  }

  if (isAuthPrompt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-400 animate-pulse">待确认</span>
      </span>
    )
  }

  if (isTaskComplete) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-green-400">已完成</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-gray-400">{config.label}</span>
    </span>
  )
}
