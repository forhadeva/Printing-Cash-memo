@echo off
title Islamic Art Prints Cash Memo App
echo Opening Islamic Art Prints App in Standalone Desktop Mode...

set "TARGET_FILE=%~dp0index.html"

:: Check if Chrome or Edge exists and launch in standalone app mode
where msedge >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start msedge --app="%TARGET_FILE%"
    exit
)

where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start chrome --app="%TARGET_FILE%"
    exit
)

:: Fallback if neither found in PATH
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%TARGET_FILE%"
    exit
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%TARGET_FILE%"
    exit
)

:: Generic default browser fallback
start "" "%TARGET_FILE%"
exit
