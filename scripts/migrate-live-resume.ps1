# Resume live migrate from a given file (inclusive). Each *.sql is idempotent.
# Usage: .\scripts\migrate-live-resume.ps1 [-From 265]
param(
  [int]$From = 265,
  [int]$Retries = 4
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$migDir = Join-Path $root 'apps\api\migrations'
$envFile = Join-Path $root '.env'

$raw = Get-Content $envFile | Where-Object { $_ -match '^DAMA_DATABASE_URL=' } | Select-Object -First 1
if (-not $raw) { $raw = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1 }
if (-not $raw) { throw 'DAMA_DATABASE_URL / DATABASE_URL missing from .env' }
$url = ($raw -replace '^[^=]+=', '').Trim().Trim('"').Trim("'")
if ($url -match 'localhost|127\.0\.0\.1') { throw 'refusing local URL' }
Write-Host 'TARGET=live_remote'

$files = @(Get-ChildItem (Join-Path $migDir '*.sql') | Sort-Object Name)
$startName = '{0:D3}_' -f $From
$queue = @($files | Where-Object { $_.Name -ge $startName })
Write-Host "RESUME_FROM=$($queue[0].Name) COUNT=$($queue.Count) LAST=$($queue[-1].Name)"

function Invoke-SqlFile([string]$Path) {
  # Capture stdout+stderr without treating Postgres NOTICE as a terminating error.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = docker run --rm -v "${Path}:/mig.sql:ro" postgres:16-alpine `
      psql "$url" -v ON_ERROR_STOP=1 -f /mig.sql 2>&1
    return @{ Code = $LASTEXITCODE; Text = (($out | ForEach-Object { "$_" }) -join "`n") }
  } finally {
    $ErrorActionPreference = $prev
  }
}

$failed = @()
foreach ($f in $queue) {
  $ok = $false
  for ($i = 1; $i -le $Retries; $i++) {
    Write-Host "APPLY $($f.Name) attempt=$i/$Retries"
    $res = Invoke-SqlFile $f.FullName
    $text = $res.Text
    $hardFail = ($res.Code -ne 0) -or ($text -match 'psql: error:|FATAL:|connection to server|SSL SYSCALL|wsarecv|ERROR:')
    # NOTICE / already exists is fine for idempotent DDL.
    if (-not $hardFail) {
      Write-Host "OK $($f.Name)"
      $ok = $true
      break
    }
    $snip = $text.Trim()
    if ($snip.Length -gt 200) { $snip = $snip.Substring(0, 200) }
    Write-Host "RETRY $($f.Name) :: $snip"
    Start-Sleep -Seconds (3 * $i)
  }
  if (-not $ok) {
    $failed += $f.Name
    Write-Host "FAIL $($f.Name)"
    break
  }
}

if ($failed.Count) {
  Write-Host ("FAILED=" + ($failed -join ','))
  exit 1
}
Write-Host 'RESUME_OK'
exit 0
