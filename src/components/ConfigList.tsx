import React from 'react'
import { Plus, Settings } from 'lucide-react'
import { Instance } from '../types'

interface ConfigListProps {
  configs: Instance[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
}

export const ConfigList: React.FC<ConfigListProps> = ({ configs, selectedId, onSelect, onCreateNew }) => {
  return (
    <div className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h1 className="text-sm font-semibold text-gray-200">Agent启动器</h1>
        <button
          onClick={onCreateNew}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="新建配置"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {configs.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-8">
            暂无配置，点击 + 创建
          </div>
        )}
        {configs.map(config => (
          <button
            key={config.id}
            onClick={() => onSelect(config.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
              selectedId === config.id
                ? 'bg-blue-600/20 border border-blue-500/40'
                : 'hover:bg-gray-800 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-gray-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-200 truncate">{config.name}</div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {config.model || '默认模型'}
                  {config.apiBaseUrl ? ` · ${new URL(config.apiBaseUrl).host}` : ''}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
