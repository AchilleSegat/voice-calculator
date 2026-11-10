@echo off
rem Stops the voice calculator's background server
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 4747 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force; Write-Host 'Voice Calculator server stopped.' } else { Write-Host 'The server was not running.' }"
timeout /t 2 /nobreak >nul
