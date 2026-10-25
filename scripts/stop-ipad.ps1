$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$statePath = Join-Path $projectRoot '.data\ipad\processes.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Host 'No Waraq background processes are recorded.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($item in @($state.processes | Sort-Object @{Expression={if ($_.role -eq 'https') {0} elseif ($_.role -eq 'api-worker') {1} else {2}}})) {
    $process = Get-Process -Id $item.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $item.started) {
        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
        Write-Host "Stopped Waraq $($item.role)."
    }
}
[pscustomobject]@{address=$state.address;processes=@()} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
Write-Host 'Books and dictionaries remain stored on your devices.'
