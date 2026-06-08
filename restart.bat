@echo off
title SMBify Image Enhancer - Restart
cd /d "%~dp0"

echo ===================================================
echo   SMBIFY IMAGE ENHANCER RESTART
echo ===================================================
echo.

echo [INFO] Stopping any existing server running on port 8080...
set "FOUND_PORT="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr LISTENING ^| findstr :8080') do (
    echo [INFO] Found process with PID %%a on port 8080. Terminating...
    taskkill /f /pid %%a >nul 2>&1
    set FOUND_PORT=1
)

if "%FOUND_PORT%"=="" (
    echo [INFO] No active server found on port 8080.
) else (
    echo [INFO] Successfully stopped existing server.
)
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in your PATH.
    echo Please download and install Node.js from: https://nodejs.org/
    echo after installation, restart this script.
    echo.
    pause
    exit /b
)

:: Start the application in the browser
echo [INFO] Opening SMBify Image Enhancer in your browser...
start "" "http://localhost:8080"

:: Start the node server
echo [INFO] Starting the server...
node server.js

echo.
echo Server stopped.
pause
