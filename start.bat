@echo off
title SMBify Image Enhancer - Startup
cd /d "%~dp0"

echo ===================================================
echo   SMBIFY IMAGE ENHANCER STARTUP
echo ===================================================
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
