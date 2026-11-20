# UX / chrome / play parity smoke (Trim SkipPagination + smart-menu play surface).
# Requires API on :8080 with DAMA_ALLOW_E2E_AUTH=1.
$ErrorActionPreference = "Stop"
$base = if ($env:DAMA_API_ORIGIN) { "$($env:DAMA_API_ORIGIN.TrimEnd('/'))/api/v1" } else { "http://127.0.0.1:8080/api/v1" }

function Assert-True($cond, $msg) {
  if (-not $cond) { throw "FAIL: $msg" }
  Write-Host "OK  $msg"
}

# 1) Unauth JSON 401 (curl - PowerShell stream body on 401 is unreliable)
$unauth = curl.exe -s -i "$base/auth/me" 2>&1 | Out-String
Assert-True ($unauth -match '401') "unauth status 401"
Assert-True ($unauth -match '"unauthorized"') "unauth JSON body"

# 2) E2E session + AI start + abandon
$e2eBody = '{"username":"e2e_ux_parity","email":"e2e_ux_parity@example.com"}'
$e2e = Invoke-RestMethod -Uri "$base/auth/e2e/session" -Method POST -ContentType "application/json" -Body $e2eBody -TimeoutSec 20
$tok = $e2e.access_token
Assert-True ([string]::IsNullOrWhiteSpace($tok) -eq $false) "e2e access_token"
$h = @{ Authorization = "Bearer $tok" }

$start = Invoke-RestMethod -Uri "$base/games/start" -Method POST -Headers $h -ContentType "application/json" -Body '{"mode":"ai","ai_search_depth":2}' -TimeoutSec 25
Assert-True ($start.legal_moves.Count -ge 1) "AI start legal_moves"
Assert-True ($start.board.Count -ge 8) "AI start board rows"
Assert-True ($null -ne $start.move_history) "AI start move_history field"

$abandon = Invoke-RestMethod -Uri "$base/games/$($start.id)/abandon" -Method POST -Headers $h -ContentType "application/json" -Body "{}" -TimeoutSec 15
Assert-True ($abandon.outcome -eq 2 -or $abandon.outcome -eq 1) "abandon forced outcome"

# 3) Play + matchmaking + pagination chrome
$play = Invoke-RestMethod -Uri "$base/public/play-chrome" -TimeoutSec 12
Assert-True ([bool]$play.stop_game_action) "play stop_game_action"
Assert-True ([bool]$play.nav_continue_label) "play nav_continue_label"
Assert-True ([bool]$play.history_skip_go) "play history_skip_go"
Assert-True ([bool]$play.status_your_turn) "play status_your_turn"
Assert-True ([bool]$play.live_label) "play live_label"

$mm = Invoke-RestMethod -Uri "$base/public/matchmaking-chrome" -TimeoutSec 12
Assert-True ([bool]$mm.outgoing_invite_title) "matchmaking outgoing_invite_title"
Assert-True ([bool]$mm.join_pending) "matchmaking join_pending"

$adminChrome = Invoke-RestMethod -Uri "$base/public/admin-console-chrome" -TimeoutSec 12
Assert-True ([bool]$adminChrome.avatars.row_actions_label) "admin avatars row_actions_label"
Assert-True ([bool]$adminChrome.media_pool.row_actions_label) "admin media_pool row_actions_label"

$spec = Invoke-RestMethod -Uri "$base/public/spectate-chrome" -TimeoutSec 12
Assert-True ([bool]$spec.live_label) "spectate live_label"
Assert-True ([bool]$spec.history_label) "spectate history_label"
Assert-True ([bool]$spec.status_your_turn) "spectate status_your_turn"

$tourChrome = Invoke-RestMethod -Uri "$base/public/tournament-chrome" -TimeoutSec 12
Assert-True ([bool]$tourChrome.thumbnail_upload_pending) "tournament thumbnail_upload_pending"

Assert-True ([bool]$adminChrome.avatars.select_all_label) "admin avatars select_all_label"
Assert-True ([bool]$adminChrome.avatars.bulk_approve_action) "admin avatars bulk_approve_action"
Assert-True ([bool]$adminChrome.banks.select_all_label) "admin banks select_all_label"
Assert-True ([bool]$adminChrome.users.select_all_label) "admin users select_all_label"
Assert-True ([bool]$adminChrome.users.bulk_activate_action) "admin users bulk_activate_action"
Assert-True ([bool]$adminChrome.users.col_user_label) "admin users col_user_label"
Assert-True ([bool]$adminChrome.users.row_actions_label) "admin users row_actions_label"
Assert-True ([bool]$adminChrome.media_pool.select_all_label) "admin media_pool select_all_label"
Assert-True ([bool]$adminChrome.media_pool.bulk_activate_action) "admin media_pool bulk_activate_action"
Assert-True ([bool]$adminChrome.feature_flags.cash_allowed_countries_remove_pending) "admin remove_pending"

# 4) Feature flags OTP
$flags = Invoke-RestMethod -Uri "$base/feature-flags" -TimeoutSec 8
Assert-True ($null -ne $flags.otp_required) "feature-flags otp_required present"

# 5) Player tournaments list meta (Trim skip/go)
$tours = Invoke-RestMethod -Uri "$base/tournaments?skip=0&limit=10" -Headers $h -TimeoutSec 15
Assert-True ([bool]$tours.meta -or [bool]$tours.tournaments) "tournaments list shape"
if ($tours.meta) {
  Assert-True ($null -ne $tours.meta.skip_to_action_label -or $null -ne $tours.meta.first_action_label -or $null -ne $tours.meta.page_summary) "tournaments BuildMeta labels"
}

# 5b) Leaderboard BuildMeta (Trim skip/go)
$lb = Invoke-RestMethod -Uri "$base/leaderboard?skip=0&limit=10" -Headers $h -TimeoutSec 15
Assert-True ([bool]$lb.meta) "leaderboard BuildMeta"
Assert-True ($null -ne $lb.leaderboard) "leaderboard array"
Assert-True ($null -ne $lb.meta.skip_to_action_label -or $null -ne $lb.meta.first_action_label -or $null -ne $lb.meta.page_summary) "leaderboard meta labels"

# 6) Admin media-pool pagination meta
$adminBody = '{"username":"e2e_ux_admin","email":"e2e_ux_admin@example.com","role":"admin"}'
$admin = Invoke-RestMethod -Uri "$base/auth/e2e/session" -Method POST -ContentType "application/json" -Body $adminBody -TimeoutSec 20
$ah = @{ Authorization = "Bearer $($admin.access_token)" }
$media = Invoke-RestMethod -Uri "$base/media/pool/channels?skip=0&limit=10" -Headers $ah -TimeoutSec 15
Assert-True ([bool]$media.meta) "media-pool BuildMeta"
Assert-True ($null -ne $media.channels) "media-pool channels array"

Write-Host ""
Write-Host "e2e-ux-parity: ALL CHECKS PASSED"
