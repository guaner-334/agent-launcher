#Requires -RunAsAdministrator
<#
.SYNOPSIS
    AgentManager 环境一键安装脚本
.DESCRIPTION
    自动安装 Node.js LTS、Git for Windows、C++ Build Tools、Claude Code CLI
    右键此文件 → "使用 PowerShell 运行"（需管理员权限）
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # 加速 Invoke-WebRequest

# ─── 颜色输出 ───
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Skip  { param($msg) Write-Host "  ⊘ $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "  ✘ $msg" -ForegroundColor Red }

$tempDir = Join-Path $env:TEMP "agentmanager-setup"
if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }

# ═══════════════════════════════════════════
# 1. Node.js LTS
# ═══════════════════════════════════════════
Write-Step "检查 Node.js ..."

$nodeInstalled = $false
try {
    $nodeVer = (node --version 2>$null)
    if ($nodeVer) {
        $major = [int]($nodeVer -replace '^v(\d+)\..*', '$1')
        if ($major -ge 18) {
            Write-Ok "已安装 Node.js $nodeVer (满足 ≥18 要求)"
            $nodeInstalled = $true
        } else {
            Write-Skip "Node.js $nodeVer 版本过低，将升级 ..."
        }
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Step "下载 Node.js LTS ..."

    # 从 nodejs.org 获取最新 LTS 版本号
    try {
        $versions = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
        $lts = $versions | Where-Object { $_.lts -ne $false } | Select-Object -First 1
        $nodeVersion = $lts.version  # e.g. "v22.14.0"
    } catch {
        # 回退硬编码版本
        $nodeVersion = "v22.14.0"
        Write-Skip "无法获取最新版本，使用 $nodeVersion"
    }

    $nodeUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-x64.msi"
    $nodeMsi = Join-Path $tempDir "node-install.msi"

    Write-Host "  下载 $nodeUrl ..."
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing

    Write-Host "  静默安装中 ..."
    $msiArgs = "/i `"$nodeMsi`" /qn /norestart ADDLOCAL=ALL"
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Err "Node.js 安装失败 (exit code: $($proc.ExitCode))"
        exit 1
    }

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Ok "Node.js $nodeVersion 安装完成"
}

# ═══════════════════════════════════════════
# 2. C++ Build Tools (node-pty 编译需要)
# ═══════════════════════════════════════════
Write-Step "检查 C++ Build Tools ..."

$cppInstalled = $false

# 检测方法: 查找 vswhere 列出的 VS Build Tools / VS Community 带 VC++ 组件
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsInstalls = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vsInstalls) {
        Write-Ok "已安装 C++ Build Tools"
        $cppInstalled = $true
    }
}

# 备选检测: 检查 cl.exe
if (-not $cppInstalled) {
    try {
        $clPath = (where.exe cl 2>$null) | Select-Object -First 1
        if ($clPath) {
            Write-Ok "已安装 C++ 编译器: $clPath"
            $cppInstalled = $true
        }
    } catch {}
}

if (-not $cppInstalled) {
    Write-Step "安装 Visual Studio Build Tools (C++ 编译工具) ..."
    Write-Host "  node-pty 原生模块编译需要 C++ 工具链，此步骤可能需要 5-10 分钟"

    # 优先尝试 winget
    $useWinget = $false
    try {
        $wingetVer = (winget --version 2>$null)
        if ($wingetVer) { $useWinget = $true }
    } catch {}

    if ($useWinget) {
        Write-Host "  使用 winget 安装 ..."
        $wingetArgs = 'install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --passive --norestart" --accept-source-agreements --accept-package-agreements'
        $proc = Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow
        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne -1978335189) {
            Write-Skip "winget 安装返回 $($proc.ExitCode)，尝试手动下载 ..."
            $useWinget = $false
        }
    }

    if (-not $useWinget) {
        # 手动下载 vs_BuildTools.exe
        $btUrl = "https://aka.ms/vs/17/release/vs_BuildTools.exe"
        $btExe = Join-Path $tempDir "vs_BuildTools.exe"

        Write-Host "  下载 $btUrl ..."
        Invoke-WebRequest -Uri $btUrl -OutFile $btExe -UseBasicParsing

        Write-Host "  静默安装中 (可能需要 5-10 分钟) ..."
        $btArgs = "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --passive --norestart --wait"
        $proc = Start-Process -FilePath $btExe -ArgumentList $btArgs -Wait -PassThru
        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
            Write-Err "Build Tools 安装失败 (exit code: $($proc.ExitCode))"
            Write-Host "  请手动安装 Visual Studio Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
            Write-Host "  安装时勾选「使用 C++ 的桌面开发」工作负载"
        } else {
            Write-Ok "C++ Build Tools 安装完成"
        }
    } else {
        Write-Ok "C++ Build Tools 安装完成"
    }

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ═══════════════════════════════════════════
# 3. Git for Windows
# ═══════════════════════════════════════════
Write-Step "检查 Git ..."

$gitInstalled = $false
try {
    $gitVer = (git --version 2>$null)
    if ($gitVer) {
        Write-Ok "已安装 $gitVer"
        $gitInstalled = $true
    }
} catch {}

if (-not $gitInstalled) {
    Write-Step "下载 Git for Windows ..."

    # 从 GitHub API 获取最新版本
    try {
        $headers = @{ "User-Agent" = "AgentManager-Setup" }
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -Headers $headers -UseBasicParsing
        $asset = $release.assets | Where-Object { $_.name -match "Git-.*-64-bit\.exe$" } | Select-Object -First 1
        $gitUrl = $asset.browser_download_url
        $gitVersion = $release.tag_name
    } catch {
        # 回退
        $gitVersion = "v2.47.1.windows.2"
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/$gitVersion/Git-2.47.1.2-64-bit.exe"
        Write-Skip "无法获取最新版本，使用 $gitVersion"
    }

    $gitExe = Join-Path $tempDir "git-install.exe"

    Write-Host "  下载 $gitUrl ..."
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe -UseBasicParsing

    Write-Host "  静默安装中 (可能需要 1-2 分钟) ..."
    $gitArgs = "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=`"icons,ext\reg\shellhere,assoc,assoc_sh`""
    $proc = Start-Process -FilePath $gitExe -ArgumentList $gitArgs -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        Write-Err "Git 安装失败 (exit code: $($proc.ExitCode))"
        exit 1
    }

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Ok "Git $gitVersion 安装完成"
}

# 设置 CLAUDE_CODE_GIT_BASH_PATH (Claude Code 在 Windows 需要)
Write-Step "配置 Git Bash 路径 ..."

$bashPath = $null
# 常见路径
$candidates = @(
    (Join-Path $env:ProgramFiles "Git\usr\bin\bash.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Git\usr\bin\bash.exe"),
    "D:\Git\usr\bin\bash.exe",
    "C:\Git\usr\bin\bash.exe"
)
# 也尝试 where 命令
try {
    $whereBash = (where.exe bash 2>$null) | Select-Object -First 1
    if ($whereBash) { $candidates = @($whereBash) + $candidates }
} catch {}

foreach ($c in $candidates) {
    if (Test-Path $c) { $bashPath = $c; break }
}

if ($bashPath) {
    [System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_GIT_BASH_PATH", $bashPath, "User")
    $env:CLAUDE_CODE_GIT_BASH_PATH = $bashPath
    Write-Ok "CLAUDE_CODE_GIT_BASH_PATH = $bashPath"
} else {
    Write-Skip "未找到 bash.exe，Claude Code 可能需要手动设置 CLAUDE_CODE_GIT_BASH_PATH"
}

# ═══════════════════════════════════════════
# 4. Claude Code CLI
# ═══════════════════════════════════════════
Write-Step "检查 Claude Code CLI ..."

$claudeInstalled = $false
try {
    $claudeVer = $null
    # 避免在 Claude Code 内部运行时被阻塞
    $env:CLAUDECODE = ""
    $claudeVer = (claude --version 2>$null)
    if ($claudeVer) {
        Write-Ok "已安装 Claude Code $claudeVer"
        $claudeInstalled = $true
    }
} catch {}

if (-not $claudeInstalled) {
    Write-Step "安装 Claude Code CLI ..."
    Write-Host "  npm install -g @anthropic-ai/claude-code ..."

    $npmOutput = npm install -g @anthropic-ai/claude-code 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Claude Code CLI 安装失败:"
        Write-Host $npmOutput
        exit 1
    }

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Ok "Claude Code CLI 安装完成"
}

# ═══════════════════════════════════════════
# 5. 安装项目依赖 & 构建
# ═══════════════════════════════════════════
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageJson = Join-Path $scriptDir "package.json"

if (Test-Path $packageJson) {
    Write-Step "检测到 AgentManager 项目，安装依赖 ..."

    Push-Location $scriptDir
    npm install 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "npm install 完成"

        Write-Host "  构建客户端 ..."
        npm run build --workspace=client 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "客户端构建完成"
        } else {
            Write-Skip "客户端构建失败，可稍后手动运行: npm run build --workspace=client"
        }

        Write-Host "  构建服务端 ..."
        npm run build --workspace=server 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "服务端构建完成"
        } else {
            Write-Skip "服务端构建失败，可稍后手动运行: npm run build --workspace=server"
        }
    } else {
        Write-Skip "npm install 失败，可稍后手动运行"
    }
    Pop-Location
}

# ═══════════════════════════════════════════
# 6. 清理 & 汇总
# ═══════════════════════════════════════════
Write-Step "清理临时文件 ..."
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Ok "清理完成"

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green

# 刷新 PATH 后验证
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

try { Write-Host "  Node.js : $(node --version 2>$null)" -ForegroundColor White } catch { Write-Host "  Node.js : 未检测到（需重启终端）" -ForegroundColor Yellow }
try { Write-Host "  npm     : $(npm --version 2>$null)" -ForegroundColor White } catch { Write-Host "  npm     : 未检测到（需重启终端）" -ForegroundColor Yellow }
try { Write-Host "  Git     : $(git --version 2>$null)" -ForegroundColor White } catch { Write-Host "  Git     : 未检测到（需重启终端）" -ForegroundColor Yellow }

$env:CLAUDECODE = ""
try { Write-Host "  Claude  : $(claude --version 2>$null)" -ForegroundColor White } catch { Write-Host "  Claude  : 未检测到（需重启终端）" -ForegroundColor Yellow }

if ($bashPath) {
    Write-Host "  Bash    : $bashPath" -ForegroundColor White
}

Write-Host ""
Write-Host "  启动方式：" -ForegroundColor Cyan
if (Test-Path (Join-Path $scriptDir "start.bat")) {
    Write-Host "    双击 start.bat 即可启动服务" -ForegroundColor White
    Write-Host "    浏览器访问 http://localhost:3000" -ForegroundColor White
} else {
    Write-Host "    cd $(Split-Path -Parent $MyInvocation.MyCommand.Path)" -ForegroundColor White
    Write-Host "    npm run dev       # 开发模式启动" -ForegroundColor White
}
Write-Host ""

# 如果 PATH 变化了，提示重启终端
Write-Host "  ⚠ 如果上面有「未检测到」，请关闭此窗口重新打开终端" -ForegroundColor Yellow
Write-Host ""

pause
