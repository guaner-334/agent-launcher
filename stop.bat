@echo off
echo.
echo  Stopping AgentManager ...

:: Kill process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  Done.
timeout /t 2 >nul
