param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $projectRoot '.data\ipad'
$config = Get-Content -LiteralPath (Join-Path $runtimePath 'settings.json') -Raw | ConvertFrom-Json
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$caddyPath = Join-Path $projectRoot $config.caddy
$statePath = Join-Path $runtimePath 'processes.json'
$addresses = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | ForEach-Object { $_.GetIPProperties().UnicastAddresses | ForEach-Object { $_.Address.ToString() } }
if ($config.address -notin $addresses) { throw "This laptop no longer has $($config.address). Update the iPad configuration before starting; do not silently change the app's storage address." }
if (Test-Path -LiteralPath $statePath) {
    $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $running = @($saved.processes | Where-Object { $process = Get-Process -Id $_.id -ErrorAction SilentlyContinue; $process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $_.started })
    if ($running.Count -gt 0) { Write-Host "Waraq is already running at https://$($config.address)/. Run scripts\stop-ipad.ps1 before restarting."; exit 0 }
}
$inUse = @(Get-NetTCPConnection -State Listen -LocalPort 8000,80,443 -ErrorAction SilentlyContinue)
if ($inUse.Count -gt 0) { throw 'Port 8000, 80, or 443 is already in use. Stop the existing Waraq preview/server first.' }
& $caddyPath validate --config (Join-Path $projectRoot 'Caddyfile') --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy configuration did not validate.' }
$started = @()
function Save-OwnedProcess($process, $role) {
    $script:started += [pscustomobject]@{id=$process.Id; started=$process.StartTime.ToUniversalTime().Ticks.ToString(); role=$role}
    [pscustomobject]@{address=$config.address; processes=$script:started} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
}
try {
    $apiArguments = @('-m','uvicorn','server.app:app','--app-dir',('"' + $projectRoot + '"'),'--host','127.0.0.1','--port','8000','--proxy-headers','--forwarded-allow-ips','127.0.0.1')
    $apiProcess = Start-Process -FilePath $pythonPath -ArgumentList $apiArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'api.out.log') -RedirectStandardError (Join-Path $runtimePath 'api.err.log') -PassThru
    Save-OwnedProcess $apiProcess 'api-launcher'
    $healthy = $false
    for ($attempt=0; $attempt -lt 35; $attempt++) {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($health.ready) { $healthy=$true; break } } catch { }
        if ($apiProcess.HasExited) { throw 'The analysis process exited. Check .data\ipad\api.err.log.' }
        Start-Sleep -Milliseconds 500
    }
    if (!$healthy) { throw 'The analysis service did not become ready. Check .data\ipad\api.err.log.' }
    # Windows venv launchers can create a child interpreter. Record the real listener too.
    $apiListener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8000 -State Listen
    if ($apiListener.OwningProcess -ne $apiProcess.Id) { Save-OwnedProcess (Get-Process -Id $apiListener.OwningProcess) 'api-worker' }
    $caddyProcess = Start-Process -FilePath $caddyPath -ArgumentList @('run','--config',('"' + (Join-Path $projectRoot 'Caddyfile') + '"'),'--adapter','caddyfile') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'caddy.out.log') -RedirectStandardError (Join-Path $runtimePath 'caddy.err.log') -PassThru
    Save-OwnedProcess $caddyProcess 'https'
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        if ($caddyProcess.HasExited) { throw 'Caddy exited. Check .data\ipad\caddy.err.log.' }
        if (Test-Path -LiteralPath (Join-Path $projectRoot '.data\caddy\pki\authorities\local\root.crt')) { break }
        Start-Sleep -Milliseconds 250
    }
    & $pythonPath (Join-Path $PSScriptRoot 'make_ipad_profile.py')
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the public certificate profile.' }
    Write-Host 'Server is running in the background. Keep the laptop awake.'
    Write-Host "iPad setup: http://$($config.address)/"
    Write-Host "Reader:     https://$($config.address)/"
    Write-Host 'To stop: double-click Stop Waraq.cmd, or run scripts\stop-ipad.ps1.'
} catch {
    & (Join-Path $PSScriptRoot 'stop-ipad.ps1')
    throw
}
