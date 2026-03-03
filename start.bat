@echo off
title AgentManager
cd /d "%~dp0"

echo.
echo  ========================================
echo        AgentManager Starting...
echo  ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found. Please run setup.ps1 first.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed. Please run setup.ps1 first.
        echo.
        pause
        exit /b 1
    )
)

:: Build if needed
if not exist "server\dist\index.js" (
    echo  [INFO] Build not found, building now...
    echo.
    call npm run build
    if not exist "server\dist\index.js" (
        echo  [ERROR] Build failed.
        echo.
        pause
        exit /b 1
    )
)

echo   URL: http://localhost:3000
echo   Close this window to stop the server.
echo.

:: Open browser after 2s delay
start /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start server (blocking)
node server\dist\index.js
pause
