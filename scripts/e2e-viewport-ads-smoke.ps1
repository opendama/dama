# Smoke: viewport chrome, DB limits, console media routes registered (auth may 401).
$ErrorActionPreference = 'Stop'
$base = $env:DAMA_API_BASE
if (-not $base) { $base = 'http://127.0.0.1:18080' }
$base = $base.TrimEnd('/')

Write-Host "API=$base"

$pb = Invoke-RestMethod -Uri "$base/api/v1/ads/playback" -Method GET
$sc = $pb.schedule_chrome
$need = @(
  'viewport_creatives_title','viewport_desktop_ratio_label','viewport_tablet_ratio_label','viewport_mobile_ratio_label',
  'viewport_breakpoint_mobile_max','viewport_breakpoint_tablet_max','err_viewport_ratio_mismatch','err_campaign_auto_closed',
  'viewport_aspect_tolerance','viewport_max_video_bytes','clear_legacy_video_action'
)
foreach ($k in $need) {
  $v = [string]$sc.$k
  if (-not $v.Trim()) { throw "schedule_chrome missing $k" }
}
$m = [int]$sc.viewport_breakpoint_mobile_max
$t = [int]$sc.viewport_breakpoint_tablet_max
if ($m -lt 1 -or $t -le $m) { throw "invalid breakpoints mobile=$m tablet=$t" }
$tol = [double]$sc.viewport_aspect_tolerance
$maxB = [int64]$sc.viewport_max_video_bytes
if ($tol -le 0 -or $tol -gt 1) { throw "invalid viewport_aspect_tolerance=$tol" }
if ($maxB -lt 1) { throw "invalid viewport_max_video_bytes=$maxB" }
Write-Host "playback viewport chrome OK mobile_max=$m tablet_max=$t tol=$tol max_bytes=$maxB"

function Assert-Not404([string]$method, [string]$path) {
  $code = 0
  try {
    $resp = Invoke-WebRequest -Uri "$base$path" -Method $method -TimeoutSec 20 -UseBasicParsing
    $code = [int]$resp.StatusCode
  } catch {
    $resp = $_.Exception.Response
    if ($resp -and $resp.StatusCode) {
      $code = [int]$resp.StatusCode
    } elseif ($_.Exception.Message -match '\((\d{3})\)') {
      $code = [int]$Matches[1]
    }
  }
  if ($code -eq 404) { throw "$method $path returned 404 (route missing)" }
  if ($code -eq 0) {
    # Windows PowerShell may omit status on connection race right after recreate; retry once.
    Start-Sleep -Seconds 2
    try {
      Invoke-WebRequest -Uri "$base$path" -Method $method -TimeoutSec 20 -UseBasicParsing | Out-Null
      $code = 200
    } catch {
      $resp = $_.Exception.Response
      if ($resp -and $resp.StatusCode) { $code = [int]$resp.StatusCode }
      elseif ($_.Exception.Message -match '\((\d{3})\)') { $code = [int]$Matches[1] }
    }
  }
  if ($code -eq 0) { throw "$method $path returned no status" }
  if ($code -eq 404) { throw "$method $path returned 404 (route missing)" }
  Write-Host "$method $path status=$code"
}

Assert-Not404 'POST' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/creatives/desktop'
Assert-Not404 'DELETE' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/creatives/desktop'
Assert-Not404 'POST' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/creatives/tablet/video'
Assert-Not404 'DELETE' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/creatives/mobile/video'
Assert-Not404 'DELETE' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/video'
Assert-Not404 'POST' '/api/v1/console/ads/campaigns/00000000-0000-0000-0000-000000000000/thumbnail'
Assert-Not404 'POST' '/api/v1/ads/campaigns/00000000-0000-0000-0000-000000000000/creatives/desktop'
Assert-Not404 'DELETE' '/api/v1/ads/campaigns/00000000-0000-0000-0000-000000000000/video'
Assert-Not404 'GET' '/api/v1/media/pool/channels'
Assert-Not404 'POST' '/api/v1/media/pool/channels'
Assert-Not404 'PUT' '/api/v1/media/pool/channels/00000000-0000-0000-0000-000000000000'
Assert-Not404 'DELETE' '/api/v1/media/pool/channels/00000000-0000-0000-0000-000000000000'

Write-Host 'e2e-viewport-ads-smoke: OK'
