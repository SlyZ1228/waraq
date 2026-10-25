param([switch]$SkipData)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw "Setup command failed ($LASTEXITCODE)." } }
if (!(Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv; Check-Exit }
& .venv\Scripts\python.exe -m pip install -r server\requirements.txt
Check-Exit
& .venv\Scripts\python.exe -m pip install camel-tools==1.6.0 --no-deps
Check-Exit
npm.cmd ci
Check-Exit
& .venv\Scripts\python.exe scripts\make_sample.py
Check-Exit
if (!$SkipData) { & .venv\Scripts\python.exe scripts\prepare_data.py; Check-Exit }
& .venv\Scripts\python.exe scripts\prepare_morphology.py
Check-Exit
npm.cmd run build
Check-Exit
Write-Host 'Ready. Run .\scripts\start.ps1 for the desktop preview.'
