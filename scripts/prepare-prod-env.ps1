# Build gitignored prod env packs from root .env (Trim-style Render/Vercel import files).
# Usage (from repo root):
#   .\scripts\prepare-prod-env.ps1 -Domain "opendama.com"
# Optional: -ApiHost "api.opendama.com" -WebHost "opendama.com" -AdminHost "admin.opendama.com"
#
# Writes (gitignored - never commit):
#   .env.prod
#   apps/api/.env.render      → paste into Render Environment
#   apps/web/.env.vercel      → paste into Vercel web (root apps/web)
#   apps/admin/.env.vercel    → paste into Vercel admin (root apps/admin)
#
# Rules:
#   - Prefer Upstash rediss:// for Redis
#   - Prefer Supabase transaction pooler for DATABASE_URL
#   - Never emit DAMA_ALLOW_* stubs
#   - Never put service_role / DB password into NEXT_PUBLIC_*

param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,
  [string]$ApiHost = "",
  [string]$WebHost = "",
  [string]$AdminHost = "",
  [switch]$SyncSecretsToRoot
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env")) {
  throw "Missing root .env - copy .env.example and fill local/cloud secrets first."
}

if (-not $ApiHost) { $ApiHost = "api.$Domain" }
if (-not $WebHost) { $WebHost = $Domain }
if (-not $AdminHost) { $AdminHost = "admin.$Domain" }

function Get-DotEnvMap([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1)
    $map[$k] = $v
  }
  return $map
}

function Get-MapVal($map, [string[]]$keys, [string]$default = "") {
  foreach ($k in $keys) {
    if ($map.ContainsKey($k) -and -not [string]::IsNullOrWhiteSpace([string]$map[$k])) {
      return [string]$map[$k]
    }
  }
  return $default
}

function New-SecretB64([int]$bytes = 48) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return [Convert]::ToBase64String($buf)
}

function New-SecretHex([int]$bytes = 32) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return ([BitConverter]::ToString($buf) -replace "-", "").ToLowerInvariant()
}

function Set-DotEnvKey([string]$path, [string]$key, [string]$value) {
  if (-not (Test-Path $path)) { return }
  $lines = Get-Content $path
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=")) {
      $found = $true
      "$key=$value"
    } else {
      $line
    }
  }
  if (-not $found) { $out = @($out) + "$key=$value" }
  Set-Content -Path $path -Value $out -Encoding utf8
}

function Ensure-SslMode([string]$url) {
  if (-not $url) { return $url }
  if ($url -match "sslmode=") { return $url }
  if ($url.Contains("?")) { return $url + "&sslmode=require" }
  return $url + "?sslmode=require"
}

$m = Get-DotEnvMap ".env"
$prevRender = Get-DotEnvMap "apps/api/.env.render"

# --- Database: transaction pooler preferred for API ---
$db = Get-MapVal $m @(
  "SUPABASE_DB_POOLER_TRANSACTION_URL",
  "SUPABASE_DB_POOLER_SESSION_URL",
  "DAMA_DATABASE_URL",
  "DATABASE_URL",
  "SUPABASE_DB_DIRECT_URL"
)
$db = Ensure-SslMode $db
if (-not $db) { Write-Warning "DATABASE_URL empty - fill Supabase pooler URI before Render deploy." }

# --- Redis: prefer TLS rediss:// ; never ship plain redis:// when rediss exists ---
$redisTls = Get-MapVal $m @("REDIS_URL")
$redisAlt = Get-MapVal $m @("DAMA_REDIS_URL")
$redis = ""
if ($redisTls -match "^rediss://") {
  $redis = $redisTls
} elseif ($redisAlt -match "^rediss://") {
  $redis = $redisAlt
} elseif ($redisTls) {
  $redis = $redisTls
} else {
  $redis = $redisAlt
}
if ($redis -match "^redis://" -and $redis -notmatch "^rediss://") {
  Write-Warning "REDIS_URL is redis:// (no TLS). Prefer rediss:// from Upstash for production."
}

# --- Signing secrets: reuse prior pack if local still has change-me ---
$jwt = Get-MapVal $m @("DAMA_JWT_SECRET", "JWT_SECRET")
$secretsKey = Get-MapVal $m @("DAMA_SECRETS_KEY")
$weakJwt = ($jwt -match "change-me") -or ($jwt.Length -lt 32)
$weakSk = ($secretsKey -match "change-me") -or ($secretsKey.Length -lt 32)

if ($weakJwt) {
  $jwt = Get-MapVal $prevRender @("DAMA_JWT_SECRET")
  if (($jwt -match "change-me") -or ($jwt.Length -lt 32)) { $jwt = New-SecretB64 48 }
  Write-Host "Using strong DAMA_JWT_SECRET for prod packs (local .env still has placeholder)."
  if ($SyncSecretsToRoot) {
    Set-DotEnvKey ".env" "DAMA_JWT_SECRET" $jwt
    Set-DotEnvKey ".env" "JWT_SECRET" $jwt
    Write-Host "Synced DAMA_JWT_SECRET / JWT_SECRET into root .env"
  }
}
if ($weakSk) {
  $secretsKey = Get-MapVal $prevRender @("DAMA_SECRETS_KEY")
  if (($secretsKey -match "change-me") -or ($secretsKey.Length -lt 32)) { $secretsKey = New-SecretHex 32 }
  Write-Host "Using strong DAMA_SECRETS_KEY for prod packs (local .env still has placeholder)."
  if ($SyncSecretsToRoot) {
    Set-DotEnvKey ".env" "DAMA_SECRETS_KEY" $secretsKey
    Write-Host "Synced DAMA_SECRETS_KEY into root .env"
  }
}

$supabaseUrl = Get-MapVal $m @("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
$supabaseJwt = Get-MapVal $m @("SUPABASE_JWT_SECRET")
$supabaseAnon = Get-MapVal $m @("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
$supabasePub = Get-MapVal $m @("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

$cors = "https://$WebHost,https://www.$Domain,https://$AdminHost"
$apiBase = "https://$ApiHost"
# Canonical browser origin: Vercel serves apex→www 308, so SITE_URL prefers www.
$webOrigin = if ($WebHost -eq $Domain -or $WebHost -eq "www.$Domain") {
  "https://www.$Domain"
} else {
  "https://$WebHost"
}
$adminOrigin = "https://$AdminHost"

$chapaBase = Get-MapVal $m @("CHAPA_BASE_URL") "https://api.chapa.co/v1"
$paddleEnv = Get-MapVal $m @("PADDLE_ENV") "live"
$mediaCdn = Get-MapVal $m @("NEXT_PUBLIC_MEDIA_CDN_HOST") "res.cloudinary.com"
$paddleClient = Get-MapVal $m @("PADDLE_CLIENT_TOKEN", "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN")

$render = @"
# =============================================================================
# dama-api - Render Environment (paste into Dashboard → Environment)
# Generated by scripts/prepare-prod-env.ps1 - DO NOT COMMIT
# Service: Docker | rootDir apps/api | health /readyz | domain $ApiHost
# Never set: DAMA_ALLOW_MEMORY, DAMA_ALLOW_DEV_SECRETS, DAMA_ALLOW_E2E_AUTH, DAMA_ALLOW_PAYMENT_STUB
# =============================================================================

DAMA_API_HOST=0.0.0.0
DATABASE_URL=$db
DAMA_DATABASE_URL=$db
REDIS_URL=$redis
DAMA_REDIS_URL=$redis
DAMA_JWT_SECRET=$jwt
DAMA_SECRETS_KEY=$secretsKey
DAMA_READYZ_TIMEOUT_SEC=5
DAMA_RATE_LIMIT_PER_MINUTE=120
DAMA_PUBLIC_API_BASE=$apiBase
DAMA_CORS_ORIGINS=$cors
SUPABASE_URL=$supabaseUrl
SUPABASE_JWT_SECRET=$supabaseJwt
SUPABASE_ANON_KEY=$supabaseAnon
CLOUDINARY_CLOUD_NAME=$(Get-MapVal $m @("CLOUDINARY_CLOUD_NAME"))
CLOUDINARY_API_KEY=$(Get-MapVal $m @("CLOUDINARY_API_KEY"))
CLOUDINARY_API_SECRET=$(Get-MapVal $m @("CLOUDINARY_API_SECRET"))
DAMA_MEDIA_PUBLIC_BASE=$(Get-MapVal $m @("DAMA_MEDIA_PUBLIC_BASE"))
DAMA_ALLOW_LOCAL_MEDIA=false
CHAPA_SECRET_KEY=$(Get-MapVal $m @("CHAPA_SECRET_KEY"))
CHAPA_PUBLIC_KEY=$(Get-MapVal $m @("CHAPA_PUBLIC_KEY"))
CHAPA_ENCRYPTION_KEY=$(Get-MapVal $m @("CHAPA_ENCRYPTION_KEY"))
CHAPA_WEBHOOK_SECRET=$(Get-MapVal $m @("CHAPA_WEBHOOK_SECRET"))
CHAPA_BASE_URL=$chapaBase
CHAPA_TEST_MODE=false
CHAPA_WEBHOOK_URL=$apiBase/api/v1/payments/local/webhook
PADDLE_API_KEY=$(Get-MapVal $m @("PADDLE_API_KEY"))
PADDLE_WEBHOOK_SECRET=$(Get-MapVal $m @("PADDLE_WEBHOOK_SECRET"))
PADDLE_CLIENT_TOKEN=$paddleClient
PADDLE_ENV=$paddleEnv
PADDLE_WEBHOOK_URL=$apiBase/api/v1/payments/international/webhook
"@

$webVercel = @"
# =============================================================================
# @dama/web - Vercel Environment (Production)
# Generated by scripts/prepare-prod-env.ps1 - DO NOT COMMIT
# Root Directory: apps/web | Include files outside root: ON
# Domain: $WebHost (+ www)
# Browser-safe only - never service_role / JWT / DB / Redis
# =============================================================================

NEXT_PUBLIC_API_URL=$apiBase/graphql
NEXT_PUBLIC_REST_URL=$apiBase/api/v1
NEXT_PUBLIC_WS_URL=wss://$ApiHost/ws
NEXT_PUBLIC_BRAND_NAME=dama
NEXT_PUBLIC_SITE_URL=$webOrigin
NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseAnon
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$supabasePub
NEXT_PUBLIC_APP_PATH_LOGIN=/auth/login
NEXT_PUBLIC_APP_PATH_AUTH_CALLBACK=/auth/callback
NEXT_PUBLIC_APP_PATH_OAUTH_COMPLETE=/auth/oauth/complete
NEXT_PUBLIC_SUPABASE_ENV_MISSING=Supabase Auth is not configured.
NEXT_PUBLIC_MEDIA_CDN_HOST=$mediaCdn
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$paddleClient
NEXT_PUBLIC_PADDLE_ENV=$paddleEnv
"@

$adminVercel = @"
# =============================================================================
# @dama/admin - Vercel Environment (Production) - SECOND project
# Generated by scripts/prepare-prod-env.ps1 - DO NOT COMMIT
# Root Directory: apps/admin | Include files outside root: ON
# Domain: $AdminHost | put Cloudflare Access in front
# Browser-safe only - never service_role / JWT / DB / Redis
# =============================================================================

NEXT_PUBLIC_API_URL=$apiBase/graphql
NEXT_PUBLIC_REST_URL=$apiBase/api/v1
NEXT_PUBLIC_WS_URL=wss://$ApiHost/ws
NEXT_PUBLIC_SITE_URL=$adminOrigin
NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseAnon
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$supabasePub
NEXT_PUBLIC_APP_PATH_LOGIN=/auth/login
NEXT_PUBLIC_APP_PATH_AUTH_CALLBACK=/auth/callback
NEXT_PUBLIC_APP_PATH_OAUTH_COMPLETE=/auth/oauth/complete
NEXT_PUBLIC_SUPABASE_ENV_MISSING=Supabase Auth is not configured.
"@

Set-Content -Path ".env.prod" -Value $render -Encoding utf8
Set-Content -Path "apps/api/.env.render" -Value $render -Encoding utf8
Set-Content -Path "apps/web/.env.vercel" -Value $webVercel -Encoding utf8
Set-Content -Path "apps/admin/.env.vercel" -Value $adminVercel -Encoding utf8

# Sanity (no secret values printed)
function Assert-Has([hashtable]$map, [string]$key, [string]$label) {
  if (-not $map.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$map[$key])) {
    Write-Warning "$label missing: $key"
  }
}
$rr = Get-DotEnvMap "apps/api/.env.render"
$ww = Get-DotEnvMap "apps/web/.env.vercel"
$aa = Get-DotEnvMap "apps/admin/.env.vercel"
Assert-Has $rr "DATABASE_URL" "Render"
Assert-Has $rr "REDIS_URL" "Render"
Assert-Has $rr "DAMA_JWT_SECRET" "Render"
Assert-Has $rr "SUPABASE_JWT_SECRET" "Render"
Assert-Has $ww "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Web"
Assert-Has $aa "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Admin"

$redisScheme = (($rr["REDIS_URL"] -split "://")[0])
Write-Host ""
Write-Host "Wrote (gitignored):"
Write-Host "  .env.prod"
Write-Host "  apps/api/.env.render"
Write-Host "  apps/web/.env.vercel"
Write-Host "  apps/admin/.env.vercel"
Write-Host ""
Write-Host "Hosts:"
Write-Host "  Web:   $webOrigin  (+ https://www.$Domain)"
Write-Host "  Admin: $adminOrigin"
Write-Host "  API:   $apiBase"
Write-Host "  Redis scheme in pack: $redisScheme"
Write-Host ""
Write-Host "Import:"
Write-Host "  Render  → Environment → paste apps/api/.env.render (skip comment lines)"
Write-Host "  Vercel web   → root apps/web   → paste apps/web/.env.vercel"
Write-Host "  Vercel admin → root apps/admin → paste apps/admin/.env.vercel"
Write-Host ""
Write-Host "Optional: re-run with -SyncSecretsToRoot to write strong JWT/SECRETS into .env"
Write-Host "Guide: docs/ops-deploy.md"
