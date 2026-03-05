# Agent启动器

一个帮你管理和启动 Claude Code 的桌面小工具。

你只需要填写 API 地址、密钥、模型等信息，它会自动帮你生成一条启动命令。复制这条命令到终端里粘贴运行，就能启动 Claude Code 了。

## 这个工具能做什么？

- 保存多套不同的 API 配置（比如官方 API、第三方中转等），随时切换
- 自动生成正确的启动命令，不需要自己拼参数
- API Key 加密存储在本地，界面上只显示脱敏的 Key，不会泄露
- 从已有配置一键复制创建新配置

## 下载安装

### 方式一：直接下载（推荐新手）

前往 [Releases](https://github.com/guaner-334/agent-launcher/releases) 页面，下载最新版本：

- **安装版**：`Agent启动器-Setup-x.x.x.exe` — 双击安装，自动创建桌面快捷方式
- **便携版**：`Agent启动器-x.x.x.exe` — 无需安装，双击直接运行

### 方式二：从源码运行（开发者）

需要先安装 [Node.js](https://nodejs.org/)（18 或更高版本）。

```bash
git clone https://github.com/guaner-334/agent-launcher.git
cd agent-launcher
npm install
npm run dev
```

## 使用前准备

在使用本工具之前，你需要先安装 Claude Code CLI（命令行工具）：

```bash
npm install -g @anthropic-ai/claude-code
```

安装完成后，在终端输入 `claude --version`，如果能看到版本号就说明安装成功了。

## 使用教程

### 第一步：创建配置

1. 打开 Agent启动器
2. 点击左上角的 **+** 按钮
3. 填写配置信息（带 * 的是必填项）：

| 填什么 | 说明 | 举个例子 |
|--------|------|----------|
| **名称** * | 给这个配置起个名字，方便区分 | `我的助手` |
| **工作目录** * | Claude 要在哪个文件夹里工作 | `C:\Users\你的用户名\project` |
| **API Base URL** | 如果用第三方中转 API，填这里 | `https://api.example.com` |
| **API Key** | 你的 API 密钥 | `sk-ant-xxx...` |
| **模型** | 想用哪个模型 | `claude-sonnet-4-20250514` |
| **权限模式** | 是否自动批准 Claude 的操作 | 默认是「自动批准」 |

> 小提示：如果你已经有一个配置了，创建新配置时可以选择「从模板创建」，会自动复制 API 地址和密钥等信息。

4. 点击 **创建** 按钮

### 第二步：复制启动命令

1. 在左侧列表中点击你刚创建的配置
2. 右侧会显示生成好的启动命令（绿色文字区域）
3. 点击右上角的 **复制** 按钮

> 注意：界面上显示的命令里，API Key 是隐藏的（显示为 `sk-••••xxxx`），但复制到剪贴板的是包含完整 Key 的真实命令，可以直接使用。

### 第三步：在终端中运行

1. 打开 **CMD**（命令提示符）：
   - 按 `Win + R`，输入 `cmd`，回车
2. 在终端窗口里 **右键粘贴**（或按 `Ctrl + V`）
3. 按 **回车** 运行

Claude Code 就启动了！你可以直接在终端里和它对话。

### 编辑和删除配置

- 点击配置后，在右侧点击 **编辑** 按钮修改配置
- 点击 **删除** 按钮删除不需要的配置

## 安全说明

- API Key 使用系统级加密（Windows DPAPI）存储在本地，即使别人拿到配置文件也看不到原始密钥
- 界面上不会显示完整的 Key
- 所有数据都存在你电脑本地，不会上传到任何服务器
- 本项目完全开源，代码可审查

## 常见问题

### Q：提示找不到 claude 命令？

需要先安装 Claude Code CLI：
```bash
npm install -g @anthropic-ai/claude-code
```

### Q：粘贴命令后报错？

确保你使用的是 **CMD**（命令提示符），不是 PowerShell。命令格式是针对 CMD 的。

### Q：配置数据存在哪里？

存在程序同目录下的 `data` 文件夹中。便携版直接在 exe 旁边，安装版在安装目录下。

### Q：什么是「权限模式」？

- **bypassPermissions（自动批准）**：Claude 执行文件操作、运行命令时不需要你确认，适合信任的项目
- **default（终端内确认）**：Claude 每次执行操作前都会问你是否允许，更安全

### Q：什么是「API Base URL」？

如果你用的是 Anthropic 官方 API，留空就行。如果用的是第三方中转服务（比如拼车、代理），填中转商给你的 API 地址。

## 开发者信息

### 打包发布

```bash
npm run build      # 构建
npm run package    # 打包为 Windows 安装包和便携版
```

打包产物在 `release/` 目录下。

### 技术栈

Electron + React + TypeScript + Tailwind CSS + Vite
