@echo off
title DevAI v6.0 Installer
echo ========================================================
echo  DevAI v6.0 Plugin Installer (Clipboard Bridge)
echo  No Python, no servers, no relays required.
echo ========================================================
echo.
set PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins
if not exist "%PLUGINS_DIR%" (
    echo ERROR: Roblox Plugins folder not found. Run Roblox Studio once first.
    pause
    exit /b 1
)
echo Plugins folder: %PLUGINS_DIR%
echo Deleting old DevAI files...
del /Q "%PLUGINS_DIR%\DevAI.plugin.lua" 2>nul
rmdir /S /Q "%PLUGINS_DIR%\DevAI" 2>nul
echo Copying DevAI.plugin.lua...
copy /Y "%~dp0DevAI.plugin.lua" "%PLUGINS_DIR%\DevAI.plugin.lua"
echo.
if exist "%PLUGINS_DIR%\DevAI.plugin.lua" (
    echo SUCCESS! DevAI v6 plugin installed.
) else (
    echo FAILED to copy. Try running this as Administrator.
    pause
    exit /b 1
)
echo.
echo NEXT STEPS:
echo 1. Open Roblox Studio (or fully close and reopen if it was already open).
echo 2. Click the DevAI button on the Plugins tab to open the panel.
echo 3. Open https://enestrupi.github.io/DevAI/ in your browser.
echo 4. In any code block, click the green "Send to Studio" button.
echo    The script is copied to your clipboard; the plugin will auto-insert it in ~1 second.
echo 5. To send code FROM Studio TO the website:
echo    - Select a script in Explorer
echo    - Click "Send Selected Script" in the plugin
echo    - On the website, click "Read from Clipboard" (top of Studio Sync tab)
echo.
echo Opening the DevAI website now...
start "" "https://enestrupi.github.io/DevAI/"
echo.
pause
