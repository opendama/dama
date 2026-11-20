# Start dama admin console on a bindable port.
# Windows Hyper-V often excludes TCP 2918-3117 (includes 3001). Prefer 3201.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$admin = Join-Path $root "apps\admin"
$port = 3201
try {
  $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 3001)
  $l.Start(); $l.Stop()
  $port = 3001
} catch {
  Write-Host "Port 3001 is blocked on this host (Hyper-V excluded range). Using http://localhost:$port"
  Write-Host "To free 3001 (Admin PowerShell):"
  Write-Host "  netsh int ipv4 delete excludedportrange protocol=tcp startport=2918 numberofports=100"
  Write-Host "  netsh int ipv4 delete excludedportrange protocol=tcp startport=3018 numberofports=100"
}

Set-Location $admin
$env:PORT = "$port"
Write-Host "Admin => http://localhost:$port  (users / rbac)"
npx next dev -H :: -p $port
