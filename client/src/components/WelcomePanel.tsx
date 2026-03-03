import React, { useState } from 'react';
import { Terminal, Command, Zap, BookOpen } from 'lucide-react';

type Lang = 'zh' | 'en';

const translations = {
  zh: {
    title: 'AgentManager',
    subtitle: 'Claude Code 多实例管理器',
    capabilities: 'Claude Code 功能',
    cap1: '读取、编写和重构项目代码',
    cap2: '运行终端命令并分析输出',
    cap3: '搜索代码库并理解架构',
    cap4: '修复 Bug、编写测试和添加功能',
    cap5: '管理 Git 操作并创建 PR',
    commands: '常用命令',
    cmdInit: '初始化 CLAUDE.md',
    cmdCompact: '压缩上下文',
    cmdCost: '查看 Token 用量',
    cmdClear: '清空对话',
    cmdHelp: '显示帮助',
    cmdReview: '代码审查',
    shortcuts: '快捷键',
    scCancel: '取消当前任务',
    scAccept: '接受编辑',
    scEsc: '中断 / 返回',
    scEnter: '确认操作',
    footer: '从看板中选择一个实例，或新建一个开始使用。',
  },
  en: {
    title: 'AgentManager',
    subtitle: 'Claude Code multi-instance manager',
    capabilities: 'Claude Code Capabilities',
    cap1: 'Read, write, and refactor code across your project',
    cap2: 'Run shell commands and analyze output',
    cap3: 'Search codebases and understand architecture',
    cap4: 'Fix bugs, write tests, and add features',
    cap5: 'Manage git operations and create PRs',
    commands: 'Useful Commands',
    cmdInit: 'Initialize CLAUDE.md',
    cmdCompact: 'Compact context',
    cmdCost: 'Show token usage',
    cmdClear: 'Clear conversation',
    cmdHelp: 'Show help',
    cmdReview: 'Code review',
    shortcuts: 'Keyboard Shortcuts',
    scCancel: 'Cancel current task',
    scAccept: 'Accept edits',
    scEsc: 'Interrupt / go back',
    scEnter: 'Confirm action',
    footer: 'Select an instance from the kanban board, or create a new one to get started.',
  },
} as const;

export const WelcomePanel: React.FC = () => {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('welcome-lang') as Lang) || 'zh';
  });
  const t = translations[lang];

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    localStorage.setItem('welcome-lang', next);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 items-center justify-center p-8 text-gray-300">
      <div className="max-w-lg space-y-8">
        {/* Title */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Terminal size={32} className="text-blue-400" />
            <h1 className="text-2xl font-bold text-white">{t.title}</h1>
            <button
              onClick={toggleLang}
              className="ml-2 px-2 py-0.5 text-xs rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
            >
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
          <p className="text-gray-500 text-sm">
            {t.subtitle}
          </p>
        </div>

        {/* What Claude Code can do */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">{t.capabilities}</h2>
          </div>
          <ul className="text-sm space-y-1.5 text-gray-400 ml-6 list-disc">
            <li>{t.cap1}</li>
            <li>{t.cap2}</li>
            <li>{t.cap3}</li>
            <li>{t.cap4}</li>
            <li>{t.cap5}</li>
          </ul>
        </div>

        {/* Commands */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Command size={16} className="text-green-400" />
            <h2 className="text-sm font-semibold text-white">{t.commands}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { cmd: '/init', desc: t.cmdInit },
              { cmd: '/compact', desc: t.cmdCompact },
              { cmd: '/cost', desc: t.cmdCost },
              { cmd: '/clear', desc: t.cmdClear },
              { cmd: '/help', desc: t.cmdHelp },
              { cmd: '/review', desc: t.cmdReview },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-center gap-2 bg-gray-800 rounded px-2.5 py-1.5">
                <code className="text-blue-400 font-mono text-xs">{cmd}</code>
                <span className="text-gray-500 text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">{t.shortcuts}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { key: 'Ctrl+C', desc: t.scCancel },
              { key: 'Shift+Tab', desc: t.scAccept },
              { key: 'Esc', desc: t.scEsc },
              { key: 'Enter', desc: t.scEnter },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-2 bg-gray-800 rounded px-2.5 py-1.5">
                <kbd className="text-amber-400 font-mono text-xs">{key}</kbd>
                <span className="text-gray-500 text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Getting started */}
        <div className="text-center text-sm text-gray-500 border-t border-gray-800 pt-6">
          {t.footer}
        </div>
      </div>
    </div>
  );
};
