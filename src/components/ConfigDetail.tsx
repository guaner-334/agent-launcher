import React, { useState, useEffect } from 'react'
import { Copy, Check, Pencil, Trash2, Terminal } from 'lucide-react'
import { Instance } from '../types'

type ShellType = 'cmd' | 'powershell'

interface ConfigDetailProps {
  config: Instance | null
  onEdit: () => void
  onDelete: (id: string) => void
}

export const ConfigDetail: React.FC<ConfigDetailProps> = ({ config, onEdit, onDelete }) => {
  const [displayCommand, setDisplayCommand] = useState('')
  const [copyText, setCopyText] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shell, setShell] = useState<ShellType>(() => {
    return (localStorage.getItem('preferred-shell') as ShellType) || 'cmd'
  })

  useEffect(() => {
    if (!config) {
      setDisplayCommand('')
      setCopyText('')
      return
    }
    setLoading(true)
    window.electronAPI.instances.generateCommand(config.id, shell)
      .then(result => {
        setDisplayCommand(result.display)
        setCopyText(result.copyText)
      })
      .catch(() => {
        setDisplayCommand('# 生成命令失败')
        setCopyText('')
      })
      .finally(() => setLoading(false))
  }, [config, shell])

  const handleShellChange = (newShell: ShellType) => {
    setShell(newShell)
    localStorage.setItem('preferred-shell', newShell)
  }

  const handleCopy = async () => {
    if (!copyText) return
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Terminal size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">选择一个配置，或创建新的配置</p>
        </div>
      </div>
    )
  }

  const fields: { label: string; value: string | undefined }[] = [
    { label: '工作目录', value: config.workingDirectory },
    { label: 'API Base URL', value: config.apiBaseUrl },
    { label: 'API Key', value: config.apiKey ? '••••••••' + config.apiKey.slice(-4) : undefined },
    { label: '模型', value: config.model },
    { label: '权限模式', value: config.permissionMode === 'default' ? 'default (终端内确认)' : 'bypassPermissions (自动批准)' },
    { label: 'System Prompt', value: config.systemPrompt },
    { label: '配置目录', value: config.claudeConfigDir },
  ]

  const envEntries = config.env ? Object.entries(config.env) : []

  const shellLabel = shell === 'cmd' ? 'CMD' : 'PowerShell'

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-100">{config.name}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <Pencil size={14} /> 编辑
          </button>
          <button
            onClick={() => onDelete(config.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {fields.map(({ label, value }) => value ? (
            <div key={label}>
              <div className="text-xs text-gray-500 mb-0.5">{label}</div>
              <div className="text-sm text-gray-300 font-mono break-all">{value}</div>
            </div>
          ) : null)}
        </div>

        {envEntries.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">自定义环境变量</div>
            <div className="space-y-1">
              {envEntries.map(([key, value]) => (
                <div key={key} className="text-sm font-mono text-gray-300">
                  <span className="text-blue-400">{key}</span>=<span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Command block */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">启动命令</div>
              <div className="flex bg-gray-800 rounded overflow-hidden border border-gray-700">
                <button
                  onClick={() => handleShellChange('cmd')}
                  className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    shell === 'cmd'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  CMD
                </button>
                <button
                  onClick={() => handleShellChange('powershell')}
                  className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    shell === 'powershell'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  PowerShell
                </button>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-400" /> 已复制</> : <><Copy size={12} /> 复制</>}
            </button>
          </div>
          <div className="bg-gray-950 rounded-lg p-4 border border-gray-700">
            {loading ? (
              <div className="text-xs text-gray-500">生成中...</div>
            ) : (
              <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {displayCommand}
              </pre>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            界面显示的 Key 已脱敏，复制到剪贴板的是包含完整 Key 的命令。粘贴到 {shellLabel} 终端执行即可。
          </p>
        </div>
      </div>
    </div>
  )
}
