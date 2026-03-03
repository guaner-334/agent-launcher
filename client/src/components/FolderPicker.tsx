import React, { useState, useEffect } from 'react';
import { X, FolderOpen, ArrowUp, CornerDownRight } from 'lucide-react';

interface FolderPickerProps {
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface BrowseResult {
  current: string;
  parent: string | null;
  directories: string[];
}

export const FolderPicker: React.FC<FolderPickerProps> = ({ initialPath, onSelect, onClose }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPath, setManualPath] = useState('');

  const browse = async (targetPath?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = targetPath
        ? `/api/filesystem/browse?path=${encodeURIComponent(targetPath)}`
        : '/api/filesystem/browse';
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to browse');
        setLoading(false);
        return;
      }
      const data: BrowseResult = await res.json();
      setCurrentPath(data.current);
      setParent(data.parent);
      setDirectories(data.directories);
      setManualPath(data.current);
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  useEffect(() => {
    browse(initialPath || undefined);
  }, []);

  const handleNavigate = (dir: string) => {
    // If currentPath is empty (drive list), dir is the full drive path
    const target = currentPath ? `${currentPath}/${dir}` : dir;
    browse(target);
  };

  const handleGoUp = () => {
    if (parent) browse(parent);
    else browse(undefined); // go to root / drive list
  };

  const handleManualGo = () => {
    if (manualPath.trim()) {
      browse(manualPath.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold">选择目录</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Manual path input */}
        <div className="flex gap-2 p-3 border-b border-gray-700">
          <input
            type="text"
            value={manualPath}
            onChange={e => setManualPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleManualGo(); }}
            className="flex-1 bg-gray-700 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            placeholder="输入路径..."
          />
          <button
            onClick={handleManualGo}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
          >
            跳转
          </button>
        </div>

        {/* Current path + up button */}
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
          <button
            onClick={handleGoUp}
            disabled={!parent && !!currentPath}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="上级目录"
          >
            <ArrowUp size={14} />
          </button>
          <span className="truncate font-mono">{currentPath || '(驱动器列表)'}</span>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {loading && <div className="text-xs text-gray-500 p-2">加载中...</div>}
          {error && <div className="text-xs text-red-400 p-2">{error}</div>}
          {!loading && !error && directories.length === 0 && (
            <div className="text-xs text-gray-500 p-2">无子目录</div>
          )}
          {!loading && directories.map(dir => (
            <button
              key={dir}
              onClick={() => handleNavigate(dir)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded text-left"
            >
              <FolderOpen size={14} className="text-gray-500 flex-shrink-0" />
              <span className="truncate">{dir}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-400 hover:text-white"
          >
            取消
          </button>
          <button
            onClick={() => { if (currentPath) onSelect(currentPath); }}
            disabled={!currentPath}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            选择此目录
          </button>
        </div>
      </div>
    </div>
  );
};
