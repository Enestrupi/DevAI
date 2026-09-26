@echo off
echo ========================================================
echo  DevAI v2.0 Plugin Installer
echo ========================================================
echo.
set PLUGINS_DIR=%LOCALAPPDATA%\Roblox\Plugins
if not exist "%PLUGINS_DIR%" (
    echo ERROR: Roblox Plugins folder not found at %PLUGINS_DIR%
    echo Is Roblox Studio installed? Try running Studio once first.
    pause
    exit /b 1
)
echo Plugins folder: %PLUGINS_DIR%
echo.
echo Deleting old DevAI files...
del /Q "%PLUGINS_DIR%\DevAI.plugin.lua" 2>nul
rmdir /S /Q "%PLUGINS_DIR%\DevAI" 2>nul
echo Copying DevAI v2.0 plugin...
copy /Y "%~dp0DevAI.plugin.lua" "%PLUGINS_DIR%\DevAI.plugin.lua"
echo.
if exist "%PLUGINS_DIR%\DevAI.plugin.lua" (
    echo SUCCESS! DevAI.plugin.lua installed.
    for %%A in ("%PLUGINS_DIR%\DevAI.plugin.lua") do echo File size: %%~zA bytes
) else (
    echo FAILED.
)
echo.
echo NEXT STEPS:
echo 1. Fully close and restart Roblox Studio (not just the place).
echo 2. Look for the "DevAI" button on the Plugins tab.
echo 3. Open https://enestrupi.github.io/DevAI/ in your browser.
echo 4. On the website click "Studio Sync" to get a 6-char code.
echo 5. Paste the code in the DevAI plugin panel and click Connect.
echo 6. On the website, click "Send to Studio" on any generated script.
echo.
pause
