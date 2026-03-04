# AgentManager

管理多个 Claude Code CLI 实例的可视化看板工具。

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Platform](https://img.shields.io/badge/Platform-Windows-blue)

## 功能

- **看板管理** — 拖拽卡片在可自定义列名的看板之间切换
- **多实例并行** — 同时运行多个 Claude Code，各自独立工作目录和 API 配置
- **内嵌终端** — 基于 xterm.js，直接在浏览器中与 Claude 交互
- **API 隔离** — 设置自定义 API 地址时自动创建隔离配置，无需全局切换
- **实例模板** — 创建新实例时可从已有实例复制配置
- **实时状态** — 区分"运行中"、"正在工作"、"待确认"、"已完成"四种状态，token 用量实时追踪
- **操作通知** — 需要授权/选择时卡片显示提醒图标 + 系统托盘弹窗通知
- **通知开关** — 顶部状态栏铃铛按钮一键开关系统托盘通知
- **任务完成通知** — agent 输出结束等待输入时发送系统通知
- **会话历史** — 持久化保存对话日志，实例关闭后可查看历史记录
- **系统托盘** — 双击 `start.vbs` 无控制台窗口运行，托盘图标管理

## 快速开始

### 方式一：下载 Release 包（推荐）

1. 从 [Releases](https://github.com/guaner-334/AgentManager/releases) 下载最新 zip
2. 解压到任意目录
3. 确保已安装 [Node.js 18+](https://nodejs.org/)（没有则右键运行 `setup.ps1`）
4. 双击 **`start.vbs`**（托盘模式，无控制台窗口）或 **`start.bat`**（控制台模式）
5. 浏览器打开 `http://localhost:3000`

### 方式二：从源码构建

```powershell
git clone https://github.com/guaner-334/AgentManager.git
cd AgentManager

# 一键安装所有依赖（Node.js、Git、C++ Build Tools、Claude CLI）
# 右键 setup.ps1 → 使用 PowerShell 运行（需管理员权限）

# 或者手动：
npm install
npm run build
```

安装完成后双击 **`start.vbs`** 或 **`start.bat`** 启动。

## 使用说明

### 创建实例

点击 **「+ 新建实例」**，填写：

| 字段 | 说明 | 必填 |
|------|------|------|
| 名称 | 实例显示名 | ✅ |
| 工作目录 | Claude 的工作路径（可用文件夹选择器） | ✅ |
| API Base URL | 自定义 API 地址（如 MiniMax） | 否 |
| API Key | 自定义密钥 | 否 |
| 模型 | 如 `claude-sonnet-4-20250514` | 否 |

> 可从已有实例模板创建，自动复制 API 配置。

### 启动 / 停止

- 点击实例卡片上的 ▶ 按钮，或在右侧终端面板点击「启动实例」
- 点击卡片进入终端面板，直接与 Claude 对话
- 点击 ■ 按钮停止实例

### 状态指示

- **空闲** — 实例未启动
- **运行中** — 实例已启动，等待用户输入
- **正在工作** — agent 正在输出内容（文字波浪动效）
- **待确认** — 需要用户授权或选择（琥珀色脉冲，处理后自动消失）
- **已完成** — agent 完成任务等待输入（点击卡片后消失）

### 看板管理

- 拖动卡片到不同列管理任务状态
- 双击列标题可自定义列名

## 项目结构

```
AgentManager/
├── start.vbs              # 托盘模式启动（推荐）
├── start.bat              # 控制台模式启动
├── stop.bat               # 停止服务
├── tray.ps1               # 系统托盘 GUI
├── setup.ps1              # 一键安装环境
├── build-release.ps1      # 打包 Release（开发者用）
├── server/                # Express + Socket.IO 后端
│   └── src/
│       ├── index.ts           # 入口，HTTP + WebSocket
│       ├── services/
│       │   ├── ptyManager.ts  # PTY 进程管理
│       │   ├── store.ts       # 实例数据持久化
│       │   └── configIsolation.ts  # API 隔离配置
│       └── routes/
│           ├── instances.ts   # 实例 REST API
│           └── filesystem.ts  # 文件夹浏览 API
├── client/                # React + Vite 前端
│   └── src/
│       ├── App.tsx
│       └── components/
│           ├── KanbanBoard.tsx    # 看板
│           ├── KanbanColumn.tsx   # 看板列（可编辑列名）
│           ├── InstanceCard.tsx   # 实例卡片
│           ├── TerminalPanel.tsx  # 终端面板
│           ├── ConfigDialog.tsx   # 配置弹窗
│           ├── FolderPicker.tsx   # 文件夹选择器
│           └── StatusBadge.tsx    # 状态徽章
└── data/                  # 运行时数据（自动生成）
    ├── instances.json
    ├── logs/              # 终端日志
    └── claude-configs/    # 隔离配置目录
```

## 开发

```bash
npm run dev          # 同时启动前后端（热重载）
npm run dev:server   # 仅启动后端
npm run dev:client   # 仅启动前端
npm run build        # 构建生产版本
```

## 打包 Release

```powershell
# 在 PowerShell 中运行
.\build-release.ps1
# 生成 release/AgentManager-v1.0.1-win-x64.zip
```

## 环境要求

- **Node.js** 18+
- **Git**（可选，克隆仓库需要）
- **Claude Code CLI**（`npm install -g @anthropic-ai/claude-code`）
- **C++ Build Tools**（从源码安装时需要，用于编译 node-pty）

> 以上所有依赖都可通过运行 `setup.ps1` 一键安装。
