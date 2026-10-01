@echo off
SETLOCAL
TITLE 🐯 Enes AI v31 Tiger Edition

cd /d "%~dp0"

echo.
echo   =============== 🐯 ENES AI v31 (Tiger Edition) ===============
echo.

REM Install plugin
set "PLUGIN_DIR=%LOCALAPPDATA%\Roblox\Plugins"
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
copy /Y "DevAI.plugin.lua" "%PLUGIN_DIR%\" >nul
echo   [ok] Plugin installed to %PLUGIN_DIR%

REM Ensure backend folder exists with server files
if not exist "backend" mkdir backend
if not exist "backend\server.js" copy /Y "server.js" "backend\server.js" >nul 2>&1
if not exist "backend\_mockreplies.js" copy /Y "_mockreplies.js" "backend\_mockreplies.js" >nul 2>&1

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo   [!!] Node.js is not installed.
    echo        Install it FREE from https://nodejs.org/ (LTS version),
    echo        then run this file again.
    echo.
    pause
    exit /b 1
)

echo   [ok] Starting Enes AI on http://127.0.0.1:42069
echo        Keep this black window open while using Enes AI.
echo        Close this window to stop the server.
echo   ==============================================================
echo.

start "" http://127.0.0.1:42069/
cd backend && node server.js
echo.
echo   Server stopped.
pause
