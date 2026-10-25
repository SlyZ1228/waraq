# Run once as Administrator. Only this Caddy executable and these two ports on
# the configured Wi-Fi address are opened to the local subnet.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$config = Get-Content -LiteralPath (Join-Path $projectRoot '.data\ipad\settings.json') -Raw | ConvertFrom-Json
$identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (!$identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator approval is needed to add the Waraq-specific firewall rule.' }
$ruleName = 'Waraq-iPad-Local-HTTPS'
$existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Description -ne 'Managed by the local Waraq Arabic reader.') { throw 'An unrelated firewall rule already has this name.' }
    Remove-NetFirewallRule -Name $ruleName
}
New-NetFirewallRule -Name $ruleName -DisplayName 'Waraq iPad - home network HTTPS and setup' -Description 'Managed by the local Waraq Arabic reader.' -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalPort 80,443 -LocalAddress $config.address -RemoteAddress LocalSubnet -InterfaceAlias $config.interface -Program (Join-Path $projectRoot $config.caddy) | Out-Null
'Waraq firewall rule installed.' | Set-Content -LiteralPath (Join-Path $projectRoot '.data\ipad\firewall-ready.txt') -Encoding UTF8
