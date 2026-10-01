@echo off
SETLOCAL
TITLE ⚔ DevAI Bridge v3.0

cd /d "%~dp0"

echo.
echo   =============== ⚔ DEVAI v3.0 BRIDGE ================
echo.

REM Install plugin
set "PLUGIN_DIR=%LOCALAPPDATA%\Roblox\Plugins"
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
copy /Y "DevAI.plugin.lua" "%PLUGIN_DIR%\" >nul
echo   [ok] Plugin installed to %PLUGIN_DIR%

REM Ensure bridge folder
if not exist "bridge" mkdir bridge
if not exist "bridge\bridge.js" copy /Y "bridge\bridge.js" "bridge\bridge.js" >nul 2>&1

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo   [!!] Node.js not found.
    echo        Install FREE from https://nodejs.org/ (LTS) and run again.
    echo.
    echo   You can also use the website WITHOUT the bridge at:
    echo        https://enestrupi.github.io/DevAI/
    echo.
    pause
    exit /b 1
)

echo   [ok] Starting DevAI Bridge on http://127.0.0.1:42069
echo        Keep this window open while using DevAI.
echo        Close this window to stop the bridge.
echo   ======================================================
echo.

start "" http://127.0.0.1:42069/
cd bridge && node bridge.js
echo.
echo   Bridge stopped.
pause
