@echo off
rem Starts the voice calculator in Microsoft Edge: hidden background server + a regular Edge tab
cd /d "%~dp0"

powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue)) { Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0.' -WindowStyle Hidden }"
timeout /t 1 /nobreak >nul

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" http://localhost:4747
) else (
  echo Microsoft Edge not found: using start.bat
  call start.bat
)
