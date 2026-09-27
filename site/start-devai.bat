@echo off
TITLE DevAI Server v26
echo.
echo   ====================== DevAI v26 ======================
echo   Starting local backend (no Python needed)...
echo.

cd /d "%~dp0"

REM Install deps if node_modules missing
if not exist "backend\node_modules" (
    echo First run: installing dependencies...
    cd backend && call npm install --silent && cd ..
)

REM Copy plugin if not already there
set "PLUGIN_DIR=%LOCALAPPDATA%\Roblox\Plugins"
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"
copy /Y "DevAI.plugin.lua" "%PLUGIN_DIR%\" >nul
echo   Plugin installed to: %PLUGIN_DIR%

REM Start backend
echo.
echo   Starting server on http://127.0.0.1:42069
echo   The website will open in your browser automatically.
echo   Keep this window open while using DevAI.
echo   =======================================================
echo.

start "" http://127.0.0.1:42069/
cd backend && node server.js
pause
