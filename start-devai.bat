@echo off
title DevAI Bridge
echo ================================================================
echo   DevAI v4.0 - AI Co-Developer Bridge
echo ================================================================
echo.

:: Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed.
    echo.
    echo Install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install!
    echo.
    pause
    exit /b 1
)

echo [1/3] Python found.
echo [2/3] Installing plugin into Roblox Studio...

set PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins
if not exist "%PLUGINS_DIR%" mkdir "%PLUGINS_DIR%"
del /Q "%PLUGINS_DIR%\DevAI.plugin.lua" 2>nul
copy /Y "%~dp0DevAI.plugin.lua" "%PLUGINS_DIR%\DevAI.plugin.lua" >nul
if exist "%PLUGINS_DIR%\DevAI.plugin.lua" (
    echo       Plugin installed to %PLUGINS_DIR%
) else (
    echo       WARNING: Could not copy plugin. Please copy DevAI.plugin.lua manually to %PLUGINS_DIR%
)

echo [3/3] Starting DevAI Bridge on http://127.0.0.1:42069/ ...
echo.
echo KEEP THIS WINDOW OPEN while using DevAI.
echo The DevAI website will open in your browser automatically.
echo Close this window when done to stop the bridge.
echo.
echo ================================================================
echo.

:: Open the website
start "" "https://enestrupi.github.io/DevAI/?bridge=local"

:: Run the bridge (bridge.py is in the same folder as this .bat)
cd /d "%~dp0"
python bridge.py
pause
