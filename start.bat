@echo off
title AgentManager
cd /d "%~dp0"

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║        AgentManager Starting...       ║
echo  ╚═══════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 未检测到 Node.js，请先运行 setup.ps1 安装环境
    echo.
    pause
    exit /b 1
)

:: 检查 server/dist/index.js 是否存在
if not exist "server\dist\index.js" (
    echo  [提示] 未检测到构建产物，正在构建...
    echo.
    call npm run build 2>nul
    if not exist "server\dist\index.js" (
        echo  [错误] 构建失败，请先运行 setup.ps1 或手动执行 npm install ^&^& npm run build
        echo.
        pause
        exit /b 1
    )
)

echo   访问地址: http://localhost:3000
echo   关闭此窗口可停止服务
echo.

:: 延迟 1 秒后打开浏览器（给服务启动时间）
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: 启动服务（阻塞，窗口关闭 = 服务停止）
node server\dist\index.js
pause
