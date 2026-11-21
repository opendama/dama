# Production Android App Bundle. Requires android/key.properties for Play upload signing.
# Usage (from apps/mobile):
#   .\scripts\build-prod-android.ps1
# Reads API/Supabase from repo root .env / apps/web/.env.vercel when present.

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $mobileRoot)
Set-Location $mobileRoot

function Get-DotEnvMap([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $map[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1)
  }
  return $map
}

# Prefer production Vercel pack over local .env (avoids localhost AAB builds).
$local = Get-DotEnvMap (Join-Path $repoRoot ".env")
$web = Get-DotEnvMap (Join-Path $repoRoot "apps\web\.env.vercel")
$m = @{}
foreach ($k in $local.Keys) { $m[$k] = $local[$k] }
foreach ($k in $web.Keys) { $m[$k] = $web[$k] }

$apiOrigin = ""
if ($m.ContainsKey("NEXT_PUBLIC_REST_URL") -and $m["NEXT_PUBLIC_REST_URL"]) {
  $apiOrigin = ($m["NEXT_PUBLIC_REST_URL"] -replace "/api/v1/?$", "").TrimEnd("/")
} elseif ($m.ContainsKey("DAMA_PUBLIC_API_BASE") -and $m["DAMA_PUBLIC_API_BASE"]) {
  $apiOrigin = $m["DAMA_PUBLIC_API_BASE"].Trim().TrimEnd("/")
}
# Never ship a Play AAB pointed at localhost.
if ($apiOrigin -match 'localhost|127\.0\.0\.1') {
  throw "Refusing production AAB with local API origin: $apiOrigin (use apps/web/.env.vercel)"
}
$webOrigin = if ($m.ContainsKey("NEXT_PUBLIC_SITE_URL")) { $m["NEXT_PUBLIC_SITE_URL"].Trim().TrimEnd("/") } else { "" }
$supabaseUrl = if ($m.ContainsKey("NEXT_PUBLIC_SUPABASE_URL")) { $m["NEXT_PUBLIC_SUPABASE_URL"].Trim() } elseif ($m.ContainsKey("SUPABASE_URL")) { $m["SUPABASE_URL"].Trim() } else { "" }
$supabaseAnon = if ($m.ContainsKey("NEXT_PUBLIC_SUPABASE_ANON_KEY")) { $m["NEXT_PUBLIC_SUPABASE_ANON_KEY"].Trim() } elseif ($m.ContainsKey("SUPABASE_ANON_KEY")) { $m["SUPABASE_ANON_KEY"].Trim() } else { "" }

if (-not $apiOrigin) { throw "DAMA_API_ORIGIN missing (set DAMA_PUBLIC_API_BASE or NEXT_PUBLIC_REST_URL)" }
if (-not $supabaseUrl -or -not $supabaseAnon) { throw "Supabase URL/anon missing in env packs" }
if (-not (Test-Path "android\key.properties")) {
  Write-Warning "android/key.properties missing: AAB will be debug-signed (not Play-uploadable)."
}

$defines = @(
  "--dart-define=DAMA_API_ORIGIN=$apiOrigin",
  "--dart-define=DAMA_SUPABASE_URL=$supabaseUrl",
  "--dart-define=DAMA_SUPABASE_ANON_KEY=$supabaseAnon"
)
if ($webOrigin) { $defines += "--dart-define=DAMA_WEB_ORIGIN=$webOrigin" }

Write-Host "Building appbundle with API $apiOrigin"
flutter pub get
flutter build appbundle --release @defines
Write-Host "Output: build\app\outputs\bundle\release\app-release.aab"
