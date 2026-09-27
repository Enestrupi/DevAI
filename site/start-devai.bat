@echo off
SETLOCAL
TITLE DevAI Server v28

cd /d "%~dp0"

echo.
echo   ================ DevAI v28 (Lemonade UI) ================
echo.

REM Install plugin
set "PLUGIN_DIR=%LOCALAPPDATA%\Roblox\Plugins"
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
copy /Y "DevAI.plugin.lua" "%PLUGIN_DIR%\" >nul
echo   [ok] Plugin installed to %PLUGIN_DIR%

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo   [!!] Node.js is not installed.
    echo        Please install it from https://nodejs.org/ (LTS version, free),
    echo        then run this file again.
    echo.
    pause
    exit /b 1
)

REM Install backend deps (only if missing)
if not exist "backend\node_modules" (
    echo   [..] Installing backend dependencies (first run only, ~30 seconds)...
    cd backend
    call npm install --omit=dev
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
