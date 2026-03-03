import React from 'react';

interface StatusBadgeProps {
  state: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: 'bg-gray-500', label: '空闲' },
  running: { color: 'bg-green-500', label: '运行中' },
  stopped: { color: 'bg-yellow-500', label: '已停止' },
  error: { color: 'bg-red-500', label: '错误' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state }) => {
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.idle;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${config.color} ${state === 'running' ? 'animate-pulse' : ''}`} />
      <span className="text-gray-400">{config.label}</span>
    </span>
  );
};
