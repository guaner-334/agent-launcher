# AgentManager

管理多个 Claude Code CLI 实例的可视化看板工具。

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Platform](https://img.shields.io/badge/Platform-Windows-blue)

## 功能

- **看板管理** — 拖拽卡片在 Todo / In Progress / Review / Done 之间切换
- **多实例并行** — 同时运行多个 Claude Code，各自独立工作目录和配置
- **内嵌终端** — 基于 xterm.js，直接在浏览器中与 Claude 交互
- **API 隔离** — 设置自定义 API 地址时自动创建隔离配置，无需 CC-Switch 全局切换
- **一键启停** — 双击 `start.bat` 启动，关闭窗口即停止

## 快速开始

### 方式一：下载 Release 包（推荐）

1. 从 [Releases](https://github.com/guaner-334/AgentManager/releases) 下载最新 zip
2. 解压到任意目录
3. 确保已安装 [Node.js 18+](https://nodejs.org/)（没有则右键运行 `setup.ps1`）
4. 双击 **`start.bat`**
5. 浏览器自动打开 `http://localhost:3000`

### 方式二：从源码安装

```powershell
git clone https://github.com/guaner-334/AgentManager.git
cd AgentManager

# 一键安装所有依赖（Node.js、Git、C++ Build Tools、Claude CLI）
# 右键 setup.ps1 → 使用 PowerShell 运行（需管理员权限）

# 或者手动：
npm install
npm run build
```

安装完成后双击 **`start.bat`** 启动。

## 使用说明

### 创建实例

点击 **「+ 新建实例」**，填写：

| 字段 | 说明 | 必填 |
|------|------|------|
| 名称 | 实例显示名 | ✅ |
| 工作目录 | Claude 的工作路径 | ✅ |
| API Base URL | 自定义 API 地址（如 MiniMax） | 否 |
| API Key | 自定义密钥 | 否 |
| 模型 | 如 `claude-sonnet-4-20250514` | 否 |

> 填写 API Base URL 后，启动时会自动创建隔离配置目录，不影响其他实例。

### 启动 / 停止

- 点击实例卡片上的 **▶ 启动** 按钮
- 点击卡片进入终端面板，直接与 Claude 对话
- 点击 **■ 停止** 结束实例

### 看板拖拽

直接拖动卡片到不同列来管理任务状态。

## 项目结构

```
AgentManager/
├── start.bat              # 双击启动
├── stop.bat               # 双击停止
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
│           └── instances.ts   # REST API
├── client/                # React + Vite 前端
│   └── src/
│       ├── App.tsx
│       └── components/
│           ├── KanbanBoard.tsx    # 看板
│           ├── InstanceCard.tsx   # 实例卡片
│           ├── TerminalPanel.tsx  # 终端面板
│           └── ConfigDialog.tsx   # 配置弹窗
└── data/                  # 运行时数据（自动生成）
    └── instances.json
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
# 生成 release/AgentManager-v1.0.0-win-x64.zip
```

## 环境要求

- **Node.js** 18+
- **Git**（可选，克隆仓库需要）
- **Claude Code CLI**（`npm install -g @anthropic-ai/claude-code`）
- **C++ Build Tools**（从源码安装时需要，用于编译 node-pty）

> 以上所有依赖都可通过运行 `setup.ps1` 一键安装。
