# Apply all local apps/api/migrations/*.sql to live DB via migrateonly (idempotent).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
$apiDir = Join-Path $root 'apps\api'

$raw = Get-Content $envFile | Where-Object { $_ -match '^DAMA_DATABASE_URL=' } | Select-Object -First 1
if (-not $raw) { $raw = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1 }
if (-not $raw) { throw 'DAMA_DATABASE_URL / DATABASE_URL missing from .env' }
$url = ($raw -replace '^[^=]+=', '').Trim().Trim('"').Trim("'")
if (-not $url) { throw 'database url empty' }

# Never echo URL. Confirm host class only.
if ($url -match 'supabase|amazonaws|neon|railway|render') {
  Write-Host 'TARGET=live_remote'
} elseif ($url -match 'localhost|127\.0\.0\.1') {
  Write-Host 'TARGET=local'
  throw 'refusing: URL looks local; use docker API restart for local'
} else {
  Write-Host 'TARGET=remote_other'
}

$env:DAMA_DATABASE_URL = $url
$env:DATABASE_URL = $url
# Ensure migrate runs
Remove-Item Env:DAMA_SKIP_MIGRATE -ErrorAction SilentlyContinue

Push-Location $apiDir
try {
  Write-Host 'migrateonly: starting (re-applies all numbered *.sql idempotently)...'
  go run ./cmd/migrateonly
  if ($LASTEXITCODE -ne 0) { throw "migrateonly exit $LASTEXITCODE" }
  Write-Host 'migrateonly: finished ok'
} finally {
  Pop-Location
}
