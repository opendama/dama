# Sync Go GraphQL schema into Flutter mobile contract mirror.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'apps\api\graphql\schema.graphql'
$dstDir = Join-Path $root 'apps\mobile\lib\graphql'
$dst = Join-Path $dstDir 'schema.graphql'
if (-not (Test-Path $src)) { throw "missing schema: $src" }
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Copy-Item -Force $src $dst
Write-Host "synced $src -> $dst"
$h1 = (Get-FileHash $src -Algorithm SHA256).Hash
$h2 = (Get-FileHash $dst -Algorithm SHA256).Hash
if ($h1 -ne $h2) { throw 'schema sync hash mismatch' }
Write-Host "schema_contract_ok hash=$h1"
