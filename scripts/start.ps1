param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path 'dist\index.html')) { throw 'Run .\scripts\setup.ps1 first.' }
Write-Host "Waraq: http://localhost:$Port (desktop preview)"
Write-Host 'For iPad access, use the HTTPS setup in README.md. Keep this terminal running.'
& .venv\Scripts\python.exe -m uvicorn server.app:app --host 127.0.0.1 --port $Port --proxy-headers --forwarded-allow-ips 127.0.0.1
