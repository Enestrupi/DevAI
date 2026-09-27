@echo off
SETLOCAL
TITLE DevAI Server v26

cd /d "%~dp0"

echo.
echo   ================ DevAI v26 (Lemonade Bridge) ================
echo.

REM Install plugin
set "PLUGIN_DIR=%LOCALAPPDATA%\Roblox\Plugins"
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
copy /Y "DevAI.plugin.lua" "%PLUGIN_DIR%\" >nul
echo   [ok] Plugin installed to %PLUGIN_DIR%

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo   [!!] Node.js not found.
    echo        Please install Node.js from https://nodejs.org/ (LTS version),
    echo        then run this file again.
    echo.
    pause
    exit /b 1
)

REM Install backend deps
if not exist "backend\node_modules" (
    echo   [..] Installing backend dependencies (first run only)...
    cd backend && call npm install --omit=dev --silent
    if errorlevel 1 (
        echo   [!!] npm install failed. Check your internet and try again.
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo   [ok] Starting DevAI on http://127.0.0.1:42069
echo        Keep this window open while using DevAI.
echo        Close this window to stop the server.
echo   ==============================================================
echo.

start "" http://127.0.0.1:42069/
cd backend && node server.js
echo.
echo   Server stopped.
pause
