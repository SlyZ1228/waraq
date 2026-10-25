@echo off
"C:\Program Files\PowerShell\7\pwsh.exe" -NoProfile -File "%~dp0scripts\stop-ipad.ps1"
if errorlevel 1 pause
