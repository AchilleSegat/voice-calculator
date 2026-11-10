@echo off
rem Starts the voice calculator: hidden background server + a regular Chrome tab
cd /d "%~dp0"

rem Start the server in the background (no window), unless it's already running
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue)) { Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0.' -WindowStyle Hidden }"
timeout /t 1 /nobreak >nul

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" http://localhost:4747
) else (
  start "" http://localhost:4747
)
