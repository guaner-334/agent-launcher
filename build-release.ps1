<#
.SYNOPSIS
    AgentManager Release 打包脚本（开发者用）
.DESCRIPTION
    构建项目并打包为可直接使用的 zip 文件
    用法: PowerShell -ExecutionPolicy Bypass -File build-release.ps1
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

# 读取版本号
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $pkg.version

Write-Host "`n══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AgentManager Release Builder v$version" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════`n" -ForegroundColor Cyan

# ── 1. 安装依赖 ──
Write-Host "▶ npm install ..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✘ npm install 失败" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  ✔ 依赖安装完成" -ForegroundColor Green

# ── 2. 构建 ──
Write-Host "`n▶ 构建客户端 ..." -ForegroundColor Cyan
npm run build --workspace=client
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✘ 客户端构建失败" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  ✔ 客户端构建完成" -ForegroundColor Green

Write-Host "`n▶ 构建服务端 ..." -ForegroundColor Cyan
npm run build --workspace=server
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✘ 服务端构建失败" -ForegroundColor Red
    Pop-Location; exit 1
}
Write-Host "  ✔ 服务端构建完成" -ForegroundColor Green

# ── 3. 准备打包目录 ──
$releaseName = "AgentManager-v$version-win-x64"
$releaseDir = Join-Path $scriptDir "release\$releaseName"
$releaseZip = Join-Path $scriptDir "release\$releaseName.zip"

Write-Host "`n▶ 准备打包目录 ..." -ForegroundColor Cyan

if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
if (Test-Path $releaseZip) {
    Remove-Item $releaseZip -Force
}

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# ── 4. 复制文件 ──
Write-Host "  复制服务端构建产物 ..."
New-Item -ItemType Directory -Path "$releaseDir\server\dist" -Force | Out-Null
Copy-Item -Path "server\dist\*" -Destination "$releaseDir\server\dist\" -Recurse

Write-Host "  复制客户端构建产物 ..."
New-Item -ItemType Directory -Path "$releaseDir\client\dist" -Force | Out-Null
Copy-Item -Path "client\dist\*" -Destination "$releaseDir\client\dist\" -Recurse

Write-Host "  复制 node_modules ..."
# 只复制生产依赖（server 的 node_modules）
# 由于 npm workspaces 的 hoisting, node_modules 在根目录
Copy-Item -Path "node_modules" -Destination "$releaseDir\node_modules" -Recurse

Write-Host "  复制配置文件 ..."
Copy-Item "package.json" "$releaseDir\"
Copy-Item "server\package.json" "$releaseDir\server\"

# 复制脚本
Copy-Item "start.bat" "$releaseDir\"
Copy-Item "stop.bat" "$releaseDir\"
Copy-Item "setup.ps1" "$releaseDir\"
Copy-Item "start.vbs" "$releaseDir\"
Copy-Item "tray.ps1" "$releaseDir\"

# 创建空的 data 目录结构
New-Item -ItemType Directory -Path "$releaseDir\data" -Force | Out-Null
"[]" | Out-File -FilePath "$releaseDir\data\instances.json" -Encoding UTF8 -NoNewline

Write-Host "  ✔ 文件复制完成" -ForegroundColor Green

# ── 5. 打包 zip ──
Write-Host "`n▶ 打包为 zip ..." -ForegroundColor Cyan

$releaseDirParent = Split-Path $releaseDir -Parent
if (-not (Test-Path $releaseDirParent)) {
    New-Item -ItemType Directory -Path $releaseDirParent -Force | Out-Null
}

Compress-Archive -Path $releaseDir -DestinationPath $releaseZip -Force
Write-Host "  ✔ 打包完成" -ForegroundColor Green

# ── 6. 清理临时目录 ──
Remove-Item $releaseDir -Recurse -Force

# ── 7. 输出结果 ──
$zipSize = (Get-Item $releaseZip).Length / 1MB
$zipSizeStr = "{0:N1}" -f $zipSize

Write-Host "`n══════════════════════════════════════" -ForegroundColor Green
Write-Host "  打包成功！" -ForegroundColor Green
Write-Host "══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  文件: $releaseZip" -ForegroundColor White
Write-Host "  大小: ${zipSizeStr} MB" -ForegroundColor White
Write-Host ""
Write-Host "  用户使用步骤:" -ForegroundColor Cyan
Write-Host "    1. 解压 zip 到任意目录" -ForegroundColor White
Write-Host "    2. 确保已安装 Node.js (没有则运行 setup.ps1)" -ForegroundColor White
Write-Host "    3. 双击 start.bat 启动" -ForegroundColor White
Write-Host ""

Pop-Location
