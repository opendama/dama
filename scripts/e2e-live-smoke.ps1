# Live Postgres + Redis smoke for dama (no DAMA_ALLOW_MEMORY).
$ErrorActionPreference = 'Stop'
$base = if ($env:DAMA_E2E_API) { $env:DAMA_E2E_API.TrimEnd('/') } else { 'http://127.0.0.1:8080' }
$web = if ($env:DAMA_E2E_WEB) { $env:DAMA_E2E_WEB.TrimEnd('/') } else { 'http://127.0.0.1:3000' }
# Console base URL must come from env so the smoke script does not publish a default console port.
if (-not $env:DAMA_E2E_CONSOLE) { throw "DAMA_E2E_CONSOLE is required (console base URL)" }
$console = $env:DAMA_E2E_CONSOLE.TrimEnd('/')
$results = @()
function Add-Result($n, $o, $d) { $script:results += [pscustomobject]@{ name = $n; ok = [bool]$o; detail = [string]$d } }
$redisAuth = if ($env:REDIS_PASSWORD) { $env:REDIS_PASSWORD } else { 'change-me-local-redis' }
$redisURL = if ($env:DAMA_REDIS_URL) { $env:DAMA_REDIS_URL } elseif ($env:REDIS_URL) { $env:REDIS_URL } else { '' }
$useRemoteRedis = $redisURL -match '^rediss?://'
function Invoke-RedisCli([string[]]$RedisArgs) {
  if ($useRemoteRedis) {
    # Upstash / managed Redis via TLS URL (do not print the URL).
    $tls = @()
    if ($redisURL -match '^rediss://') { $tls = @('--tls') }
    docker run --rm redis:7-alpine redis-cli @tls -u $redisURL @RedisArgs
  } else {
    docker exec -e "REDISCLI_AUTH=$redisAuth" dama_redis redis-cli @RedisArgs
  }
}

function Receive-WsMessage {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [System.Threading.CancellationTokenSource]$TokenSource,
    [byte[]]$Buffer
  )
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(, $Buffer)
  $recv = $Socket.ReceiveAsync($seg, $TokenSource.Token)
  while (-not $recv.IsCompleted) { Start-Sleep -Milliseconds 20 }
  if ($recv.IsFaulted) { throw $recv.Exception.GetBaseException() }
  return [Text.Encoding]::UTF8.GetString($Buffer, 0, $recv.Result.Count)
}

$cur = Invoke-RestMethod "$base/api/v1/payments/currency"
Add-Result 'currency_db' ($cur.global -and $cur.ethiopia -and -not $cur.PSObject.Properties['source']) "global=$($cur.global)"
Add-Result 'geo_usd' ((Invoke-RestMethod "$base/api/v1/payments/route?country_code=US").currency -eq 'USD') 'USD'
Add-Result 'geo_etb' ((Invoke-RestMethod "$base/api/v1/payments/route?country_code=ET").currency -eq 'ETB') 'ETB'

# Social-only: mint sessions via DAMA_ALLOW_E2E_AUTH=1 (never password register/login).
function New-E2ESession {
  param([string]$Username, [string]$Email, [string]$Role = '')
  $body = @{ username = $Username; email = $Email }
  if ($Role) { $body.role = $Role }
  return Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/e2e/session" -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

# Password routes must be gone.
$pwGone = $false
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/register" -ContentType 'application/json' -Body '{"username":"x","email":"x@t.test","password":"nope"}' | Out-Null
} catch {
  $pwGone = ($_.Exception.Response.StatusCode.value__ -in 404, 405)
}
if (-not $pwGone) {
  try {
    Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType 'application/json' -Body '{"username":"x","password":"nope"}' | Out-Null
  } catch {
    $pwGone = ($_.Exception.Response.StatusCode.value__ -in 404, 405)
  }
}
Add-Result 'password_auth_removed' $pwGone 'register/login gone'

$ap = Invoke-RestMethod "$base/api/v1/public/auth-providers"
$apGoogleOnly = ($ap.providers -is [System.Array]) -and ($ap.providers.Count -eq 1) -and ($ap.providers[0] -eq 'google') -and ([string]$ap.login_success_message).Trim().Length -gt 0
Add-Result 'auth_providers_google_only' $apGoogleOnly "providers=$($ap.providers -join ',')"

$wc = Invoke-RestMethod "$base/api/v1/public/wallet-chrome"
$wcReady = @($wc.payout_method_saved, $wc.payout_request_submitted, $wc.payout_phone_required, $wc.payout_method_section, $wc.payout_request_section, $wc.payout_phone_label, $wc.payout_provider_label, $wc.payout_account_label, $wc.payout_save_action, $wc.payout_request_action, $wc.payout_amount_label, $wc.payout_amount_placeholder, $wc.payout_phone_hint, $wc.payout_method_save_failed, $wc.payout_request_failed, $wc.payout_amount_currency_required, $wc.wallet_chrome_unavailable, $wc.sign_in_required, $wc.sign_in_required_checkout, $wc.page_title, $wc.balance_label, $wc.balance_pending, $wc.country_code_label, $wc.country_code_hint, $wc.top_up_amount_label, $wc.top_up_amount_placeholder, $wc.top_up_action, $wc.refresh_action, $wc.detect_location_action, $wc.location_unavailable, $wc.location_geo_failed, $wc.country_unresolved, $wc.payment_route_unavailable, $wc.payment_route_prefix, $wc.payment_route_separator, $wc.payout_required_marker, $wc.wallet_unavailable, $wc.wallet_load_failed, $wc.country_required_checkout, $wc.invalid_top_up_amount, $wc.checkout_unavailable, $wc.checkout_ready, $wc.manual_accounts_title, $wc.banks_loading, $wc.banks_empty, $wc.bank_name_prefix, $wc.bank_account_prefix, $wc.bank_mobile_prefix, $wc.bank_currency_prefix, $wc.submit_receipt_title, $wc.receipt_image_label, $wc.receipt_uploaded_prefix, $wc.submit_receipt_action, $wc.receipt_upload_failed, $wc.receipt_submitted, $wc.receipt_submit_failed, $wc.checkout_failed, $wc.location_currency_unresolved, $wc.paren_open, $wc.paren_close) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'wallet_chrome_db' ($wcReady.Count -eq 0 -and $wc.source -eq 'database') "missing=$($wcReady.Count)"

$pmc = Invoke-RestMethod "$base/api/v1/public/payment-modal-chrome"
$pmcReady = @($pmc.title, $pmc.blurb, $pmc.balance_label, $pmc.fee_label, $pmc.confirm_action, $pmc.cancel_action, $pmc.insufficient_title, $pmc.insufficient_blurb, $pmc.top_up_action, $pmc.methods_title, $pmc.methods_blurb, $pmc.checkout_action, $pmc.amount_label, $pmc.amount_placeholder, $pmc.balance_pending, $pmc.country_required_hint, $pmc.payment_modal_unavailable, $pmc.enroll_success, $pmc.enroll_failed, $pmc.already_enrolled, $pmc.confirm_pending, $pmc.checkout_pending) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'payment_modal_chrome_db' ($pmcReady.Count -eq 0) "missing=$($pmcReady.Count)"

$pc = Invoke-RestMethod "$base/api/v1/public/play-chrome"
$pcReady = @($pc.source, $pc.page_title, $pc.choose_mode_hint, $pc.board_waiting, $pc.setup_title, $pc.pvp_blurb, $pc.practice_blurb, $pc.ai_depth_label, $pc.depths_waiting, $pc.depth_option_prefix, $pc.play_computer_action, $pc.practice_unavailable, $pc.new_setup_action, $pc.toast_computer_unavailable, $pc.toast_difficulty_unavailable, $pc.toast_practice_started, $pc.toast_start_failed, $pc.toast_load_failed, $pc.toast_illegal_square, $pc.toast_live_required, $pc.toast_move_timeout, $pc.toast_move_failed, $pc.toast_live_error, $pc.toast_clock_flag, $pc.toast_clock_flag_failed, $pc.you_won_on_time_message, $pc.you_lost_on_time_message, $pc.you_drew_on_time_message, $pc.match_result_win_on_time_aria, $pc.match_result_loss_on_time_aria, $pc.match_result_draw_on_time_aria, $pc.notif_result_win_on_time, $pc.notif_result_loss_on_time, $pc.notif_result_draw_on_time, $pc.status_draw, $pc.status_draw_reason_prefix, $pc.status_draw_reason_open, $pc.status_draw_reason_close, $pc.status_p1_wins, $pc.status_p2_wins, $pc.status_multi_capture, $pc.status_white_to_move, $pc.status_black_to_move, $pc.status_your_turn, $pc.status_opponent_turn, $pc.label_mode, $pc.label_game, $pc.label_moves, $pc.label_halfmove, $pc.label_rules, $pc.label_pieces, $pc.label_white, $pc.label_black, $pc.play_chrome_unavailable, $pc.lobby_title, $pc.lobby_modes_blurb, $pc.find_1v1_action, $pc.practice_depth_label, $pc.practice_unavailable_short, $pc.live_board_title, $pc.match_clock_prefix, $pc.status_prefix, $pc.status_starting, $pc.increment_suffix, $pc.seat_meta_separator, $pc.toast_options_load_failed, $pc.status_matched, $pc.status_ws_prefix, $pc.status_synced_moves_prefix, $pc.toast_ai_depth_required, $pc.status_started, $pc.toast_ws_connection_error, $pc.paren_open, $pc.paren_close, $pc.increment_paren_open, $pc.board_size_separator, $pc.label_value_separator, $pc.id_truncate_suffix, $pc.id_truncate_chars) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
$pcTruncateOk = ([int]([string]$pc.id_truncate_chars) -gt 0)
Add-Result 'play_chrome_db' ($pcReady.Count -eq 0 -and $pc.source -eq 'database' -and $pcTruncateOk) "missing=$($pcReady.Count) truncate_chars=$($pc.id_truncate_chars)"

$mc = Invoke-RestMethod "$base/api/v1/public/matchmaking-chrome"
$mcReady = @($mc.source, $mc.title, $mc.blurb, $mc.find_match_action, $mc.leave_queue_action, $mc.players_waiting_title, $mc.queued_yes, $mc.queued_no, $mc.direct_invite_title, $mc.direct_invite_blurb, $mc.invite_placeholder, $mc.send_invite_action, $mc.accept_action, $mc.decline_action, $mc.invite_from_prefix, $mc.matched_opening, $mc.rating_label, $mc.searching_suffix, $mc.toast_match_found, $mc.toast_matched_instantly, $mc.toast_waiting_opponent, $mc.toast_join_failed, $mc.toast_invite_sent, $mc.toast_invite_failed, $mc.toast_invite_received, $mc.toast_invite_accepted, $mc.toast_invite_declined, $mc.toast_live_required, $mc.matchmaking_chrome_unavailable, $mc.meta_separator) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'matchmaking_chrome_db' ($mcReady.Count -eq 0 -and $mc.source -eq 'database') "missing=$($mcReady.Count)"

$tc = Invoke-RestMethod "$base/api/v1/public/tournament-chrome"
$tcReady = @($tc.source, $tc.page_title, $tc.page_blurb, $tc.title_label, $tc.description_label, $tc.make_free_label, $tc.entry_currency_label, $tc.entry_amount_label, $tc.prize_amount_label, $tc.prize_currency_label, $tc.prize_placeholder, $tc.create_action, $tc.existing_title, $tc.is_free_prefix, $tc.is_free_true, $tc.is_free_false, $tc.prize_prefix, $tc.toast_created, $tc.toast_create_failed, $tc.toast_status_updated, $tc.toast_status_failed, $tc.tournament_chrome_unavailable, $tc.meta_separator) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'tournament_chrome_db' ($tcReady.Count -eq 0 -and $tc.source -eq 'database') "missing=$($tcReady.Count)"

$acc = Invoke-RestMethod "$base/api/v1/public/admin-console-chrome"
$accSections = @('banks','payments','media_pool','feature_flags','avatars','telemetry','users','dashboard','progression')
$accMissing = 0
foreach ($sec in $accSections) {
  if (-not $acc.$sec) { $accMissing += 1; continue }
  $props = $acc.$sec.PSObject.Properties | Where-Object { $_.MemberType -eq 'NoteProperty' }
  foreach ($p in $props) {
    if ([string]$p.Value -eq '' -or $null -eq $p.Value) { $accMissing += 1 }
  }
}
Add-Result 'admin_console_chrome_db' ($accMissing -eq 0 -and $acc.source -eq 'database' -and $accSections.Count -eq 9) "missing=$accMissing sections=$($accSections.Count)"

$pic = Invoke-RestMethod "$base/api/v1/public/profile-inspect-chrome"
$picReady = @($pic.source, $pic.profile_inspect_chrome_unavailable, $pic.load_failed, $pic.sr_description, $pic.inspect_action, $pic.zoom_title, $pic.no_avatar, $pic.avatar_alt_suffix, $pic.label_rating, $pic.label_xp, $pic.label_level, $pic.label_wins, $pic.label_losses, $pic.label_draws, $pic.label_country, $pic.label_region, $pic.label_regional_rank, $pic.top_prefix, $pic.recent_matches_title, $pic.no_matches, $pic.tournament_placements_title, $pic.no_placements, $pic.outcome_draw, $pic.outcome_win, $pic.outcome_loss, $pic.free_suffix, $pic.pieces_left_suffix, $pic.captured_suffix, $pic.seat_meta_separator, $pic.stats_separator, $pic.page_title, $pic.zoom_hint, $pic.wld_label, $pic.moves_suffix, $pic.player_unavailable) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'profile_inspect_chrome_db' ($picReady.Count -eq 0 -and $pic.source -eq 'database') "missing=$($picReady.Count)"

$avc = Invoke-RestMethod "$base/api/v1/public/avatar-chrome"
$avcReady = @($avc.source, $avc.avatar_chrome_unavailable, $avc.page_title, $avc.page_blurb, $avc.choose_upload_action, $avc.upload_action, $avc.uploading_action, $avc.upload_failed, $avc.toast_updated, $avc.tap_inspect_hint, $avc.profile_page_title, $avc.profile_load_failed, $avc.crop_canvas_unavailable, $avc.crop_failed) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'avatar_chrome_db' ($avcReady.Count -eq 0 -and $avc.source -eq 'database') "missing=$($avcReady.Count)"

$spc = Invoke-RestMethod "$base/api/v1/public/spectate-chrome"
$spcReady = @($spc.source, $spc.spectate_chrome_unavailable, $spc.page_title, $spc.page_blurb, $spc.page_blurb_web, $spc.game_id_required, $spc.game_id_label, $spc.game_id_placeholder, $spc.waiting_game_state, $spc.enter_game_prompt, $spc.unable_to_spectate, $spc.load_game_failed, $spc.start_action, $spc.connect_action, $spc.listening_action, $spc.disconnect_action, $spc.connect_title, $spc.waiting_board, $spc.board_after_connect, $spc.board_after_connect_web, $spc.connecting_status, $spc.disconnected_status, $spc.status_draw, $spc.status_draw_reason_prefix, $spc.status_draw_reason_open, $spc.status_draw_reason_close, $spc.status_p1_wins, $spc.status_p2_wins, $spc.status_p1_wins_on_time, $spc.status_p2_wins_on_time, $spc.status_draw_on_time, $spc.status_white_to_move, $spc.status_black_to_move, $spc.event_log_title, $spc.no_events, $spc.status_live_moves_prefix) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'spectate_chrome_db' ($spcReady.Count -eq 0 -and $spc.source -eq 'database') "missing=$($spcReady.Count)"

$lbc = Invoke-RestMethod "$base/api/v1/public/leaderboard-chrome"
$lbcReady = @($lbc.source, $lbc.leaderboard_chrome_unavailable, $lbc.page_title, $lbc.page_blurb, $lbc.empty, $lbc.load_failed, $lbc.online_label, $lbc.playing_label, $lbc.offline_label, $lbc.inspect_aria_prefix, $lbc.wins_abbr, $lbc.losses_abbr, $lbc.draws_abbr, $lbc.stats_separator, $lbc.meta_separator, $lbc.rank_prefix, $lbc.xp_suffix) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'leaderboard_chrome_db' ($lbcReady.Count -eq 0 -and $lbc.source -eq 'database') "missing=$($lbcReady.Count)"

$thc = Invoke-RestMethod "$base/api/v1/public/theme-chrome"
$thcReady = @($thc.source, $thc.theme_chrome_unavailable, $thc.aria_label, $thc.label_system, $thc.label_light, $thc.label_dark, $thc.label_system_resolved_prefix, $thc.aria_template, $thc.title_template, $thc.resolved_paren_open, $thc.resolved_paren_close) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'theme_chrome_db' ($thcReady.Count -eq 0 -and $thc.source -eq 'database') "missing=$($thcReady.Count)"

$tpc = Invoke-RestMethod "$base/api/v1/public/tournaments-player-chrome"
$tpcReady = @($tpc.source, $tpc.tournaments_player_chrome_unavailable, $tpc.page_title, $tpc.page_blurb, $tpc.empty, $tpc.empty_web, $tpc.free_entry_prefix, $tpc.enroll_action, $tpc.enrolling_action, $tpc.enroll_failed, $tpc.joined_free, $tpc.enrolled_charged_prefix, $tpc.enrolled_charged_close, $tpc.enrolled_bare, $tpc.load_failed, $tpc.meta_separator) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'tournaments_player_chrome_db' ($tpcReady.Count -eq 0 -and $tpc.source -eq 'database') "missing=$($tpcReady.Count)"

$otc = Invoke-RestMethod "$base/api/v1/public/otp-chrome"
$otcReady = @($otc.source, $otc.otp_chrome_unavailable, $otc.verify_title, $otc.start_failed, $otc.invalid_code, $otc.enter_code_blurb, $otc.enter_code_blurb_web, $otc.flags_unavailable, $otc.verification_start_failed, $otc.code_label, $otc.code_placeholder, $otc.retry_action, $otc.retry_otp_action, $otc.starting_action, $otc.verify_action, $otc.verifying_action) | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -eq 0 }
Add-Result 'otp_chrome_db' ($otcReady.Count -eq 0 -and $otc.source -eq 'database') "missing=$($otcReady.Count)"

$apAdmin = ([string]$ap.admin_login_default_next).Trim().Length -gt 0
Add-Result 'auth_providers_admin_next' $apAdmin "admin_next=$($ap.admin_login_default_next)"
$apNav = ([string]$ap.nav_sign_in_label).Trim().Length -gt 0
Add-Result 'auth_providers_nav_label' $apNav "nav=$($ap.nav_sign_in_label)"
$emailPolicyOk = $false
try {
  $ep = Invoke-RestMethod "$base/api/v1/public/email-policy?email=ok@example.com"
  $emailPolicyOk = ($ep.allowed -eq $true)
} catch { $emailPolicyOk = $false }
Add-Result 'email_policy_public' $emailPolicyOk 'allowed_ok'
$emailDenied = $false
try {
  docker exec dama_postgres psql -U dama -d dama -c "INSERT INTO email_domain_denylist (domain, reason) VALUES ('denied.test', 'e2e') ON CONFLICT (domain) DO NOTHING" | Out-Null
  $ed = Invoke-RestMethod "$base/api/v1/public/email-policy?email=user@denied.test"
  $emailDenied = ($ed.allowed -eq $false)
  docker exec dama_postgres psql -U dama -d dama -c "DELETE FROM email_domain_denylist WHERE domain='denied.test'" | Out-Null
} catch { $emailDenied = $false }
Add-Result 'email_policy_denylist' $emailDenied 'denied_ok'

$u = "e2e_$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$reg = New-E2ESession -Username $u -Email "$u@t.test"
$token = $reg.access_token; if (-not $token) { $token = $reg.accessToken }
$h = @{ Authorization = "Bearer $token" }

try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/games/start" -Headers $h -ContentType 'application/json' -Body '{"mode":"ai","ai_search_depth":99}'
  $depthBad = 200
} catch {
  $depthBad = $_.Exception.Response.StatusCode.value__
}
Add-Result 'ai_depth_reject' ($depthBad -eq 400) "status=$depthBad"

try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/games/start" -Headers $h -ContentType 'application/json' -Body '{"mode":"ai"}'
  $depthMissing = 200
} catch {
  $depthMissing = $_.Exception.Response.StatusCode.value__
}
Add-Result 'ai_depth_required' ($depthMissing -eq 400) "status=$depthMissing"

$g = Invoke-RestMethod -Method Post -Uri "$base/api/v1/games/start" -Headers $h -ContentType 'application/json' -Body '{"mode":"ai","ai_search_depth":2}'
$gid = $g.id
$moves = $g.legal_moves
if (-not $moves -or $moves.Count -eq 0) {
  $st = Invoke-RestMethod "$base/api/v1/games/$gid/state"
  $moves = $st.legal_moves
}
Add-Result 'ai_moves' ($moves.Count -gt 0) "n=$($moves.Count)"

$gotState = $false
$wsDetail = ''
$flagsSnap = $false
try {
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $uri = [Uri]("ws://127.0.0.1:8080/ws/game?game_id=$gid&token=$token")
  $cts = New-Object System.Threading.CancellationTokenSource
  $cts.CancelAfter(15000)
  $conn = $ws.ConnectAsync($uri, $cts.Token)
  while (-not $conn.IsCompleted) { Start-Sleep -Milliseconds 20 }
  if ($conn.IsFaulted) { throw $conn.Exception.GetBaseException() }
  $buf = New-Object byte[] 65536
  $welcome = Receive-WsMessage -Socket $ws -TokenSource $cts -Buffer $buf
  $flagsSnap = ($welcome -match 'feature_flags') -and ($welcome -match 'vs_ai_enabled')
  $mv = $moves[0]
  $movePayload = (@{ type = 'move'; game_id = $gid; from = $mv.from; to = $mv.to } | ConvertTo-Json -Compress)
  $moveBytes = [System.Text.Encoding]::UTF8.GetBytes($movePayload)
  $moveSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$moveBytes)
  $send = $ws.SendAsync($moveSeg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token)
  while (-not $send.IsCompleted) { Start-Sleep -Milliseconds 10 }
  if ($send.IsFaulted) { throw $send.Exception.GetBaseException() }
  for ($i = 0; $i -lt 8; $i++) {
    $msg = Receive-WsMessage -Socket $ws -TokenSource $cts -Buffer $buf
    if ($msg -match 'game_state|move_ack') { $gotState = $true; $wsDetail = 'ws_move'; break }
  }
  $ws.Dispose()
} catch {
  $wsDetail = $_.Exception.Message
}
Add-Result 'ws_game_state' $gotState $wsDetail
Add-Result 'ws_flags_snapshot' $flagsSnap "welcome_flags=$flagsSnap"

$spectateOk = $false
$spectateDetail = ''
try {
  $sws = New-Object System.Net.WebSockets.ClientWebSocket
  $suri = [Uri]("ws://127.0.0.1:8080/ws/spectate?game_id=$gid")
  $scts = New-Object System.Threading.CancellationTokenSource
  $scts.CancelAfter(10000)
  $sconn = $sws.ConnectAsync($suri, $scts.Token)
  while (-not $sconn.IsCompleted) { Start-Sleep -Milliseconds 20 }
  if ($sconn.IsFaulted) { throw $sconn.Exception.GetBaseException() }
  $sbuf = New-Object byte[] 65536
  $smsg = Receive-WsMessage -Socket $sws -TokenSource $scts -Buffer $sbuf
  if ($smsg -match 'spectate|welcome') { $spectateOk = $true; $spectateDetail = 'welcome' }
  $sws.Dispose()
} catch {
  $spectateDetail = $_.Exception.Message
}
Add-Result 'ws_spectate' $spectateOk $spectateDetail

$tq = Invoke-RestMethod -Method Post -Uri "$base/graphql" -ContentType 'application/json' -Body '{"query":"{tournaments{id isFree entryFeeCurrency}}"}'
Add-Result 'tournaments_gql' ($null -ne $tq.data.tournaments) "n=$($tq.data.tournaments.Count)"

$rm = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body '{"query":"{ me { id recentMatches { id mode isFree } } }"}'
Add-Result 'gql_recent_matches' ($null -ne $rm.data.me.recentMatches) "n=$($rm.data.me.recentMatches.Count)"

try {
  Invoke-RestMethod -Method Post -Uri "$base/graphql" -ContentType 'application/json' -Body '{"query":"{ __schema { queryType { name } } }"}'
  $intro = 200
} catch {
  $intro = $_.Exception.Response.StatusCode.value__
}
Add-Result 'gql_introspection_off' ($intro -eq 403) "status=$intro"

$prog = Invoke-RestMethod "$base/api/v1/progression"
Add-Result 'progression_db' (
  $prog.match_clock.initial_seconds -gt 0 -and
  $prog.xp_levels.Count -gt 0 -and
  $prog.xp_levels[0].label
) "clock=$($prog.match_clock.initial_seconds) levels=$($prog.xp_levels.Count)"
Add-Result 'match_rewards_db' (
  $null -ne $prog.match_rewards -and
  $prog.match_rewards.win_xp -gt 0 -and
  $prog.match_rewards.loss_xp -ge 0
) "win_xp=$($prog.match_rewards.win_xp) loss_xp=$($prog.match_rewards.loss_xp)"

$adPrice = Invoke-RestMethod "$base/api/v1/ads/pricing"
Add-Result 'ad_pricing_db' ($adPrice.impression_unit_cost -gt 0) "unit=$($adPrice.impression_unit_cost)"
$adPriceET = Invoke-RestMethod "$base/api/v1/ads/pricing?lat=9.03&lng=38.74"
$adPriceUS = Invoke-RestMethod "$base/api/v1/ads/pricing?lat=40.7128&lng=-74.0060"
Add-Result 'ad_pricing_ethiopia_fee' (
  [double]$adPriceET.campaign_create_fee_amount -gt 0 -and
  $adPriceET.campaign_create_fee_currency -eq 'ETB' -and
  $adPriceET.country_code -eq 'ET'
) "fee=$($adPriceET.campaign_create_fee_amount) $($adPriceET.campaign_create_fee_currency) cc=$($adPriceET.country_code)"
Add-Result 'ad_pricing_global_fee' (
  [double]$adPriceUS.campaign_create_fee_amount -gt 0 -and
  $adPriceUS.campaign_create_fee_currency -eq 'USD' -and
  $adPriceUS.country_code -eq 'US'
) "fee=$($adPriceUS.campaign_create_fee_amount) $($adPriceUS.campaign_create_fee_currency) cc=$($adPriceUS.country_code)"

$lvl = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body '{"query":"{ me { levelLabel xp } }"}'
Add-Result 'gql_level_label' ($null -ne $lvl.data.me.levelLabel -and $lvl.data.me.levelLabel -ne '') "label=$($lvl.data.me.levelLabel)"

$lb = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body '{"query":"{ leaderboard(limit:5){ id levelLabel online } }"}'
$lbRow = $lb.data.leaderboard | Select-Object -First 1
Add-Result 'gql_leaderboard_level' ($null -ne $lbRow -and $null -ne $lbRow.levelLabel -and $lbRow.levelLabel -ne '') "label=$($lbRow.levelLabel) online=$($lbRow.online)"

$pd = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body (@{ query = '{publisherDashboard{me{id} totalImpressions} me{id}}' } | ConvertTo-Json)
Add-Result 'publisher_dash' ($null -ne $pd.data.publisherDashboard.me.id -and $null -ne $pd.data.me.id) 'ok'
$pdReach = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body (@{
    query = '{publisherDashboard{totalUniqueReach cpc ctrPercent campaigns{uniqueReach videoCompletions}}}'
  } | ConvertTo-Json)
Add-Result 'gql_unique_reach' ($null -ne $pdReach.data.publisherDashboard.totalUniqueReach) "reach=$($pdReach.data.publisherDashboard.totalUniqueReach)"
Add-Result 'gql_publisher_cpc' ($null -ne $pdReach.data.publisherDashboard.cpc) "cpc=$($pdReach.data.publisherDashboard.cpc)"

$cap = 12.5
$camp = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns" -Headers $h -ContentType 'application/json' -Body (@{
    title           = "cap_$u"
    geo_targets     = @(@{ country = 'US'; lat = 40.71; lng = -74.01 })
    creative_type   = 'image'
    daily_spend_cap = $cap
  } | ConvertTo-Json -Depth 5)
Add-Result 'daily_spend_cap' ($camp.daily_spend_cap -eq $cap) "cap=$($camp.daily_spend_cap)"
$pingAuth = (Invoke-RedisCli @('PING')).ToString().Trim()
if ($useRemoteRedis) {
  Add-Result 'redis_requirepass' ($pingAuth -eq 'PONG') "remote_tls=$pingAuth"
} else {
  $pingNoAuth = (docker exec dama_redis redis-cli PING 2>&1 | Out-String)
  Add-Result 'redis_requirepass' ($pingAuth -eq 'PONG' -and $pingNoAuth -match 'NOAUTH|WRONGPASS|Authentication') "auth=$pingAuth"
}
Invoke-RedisCli @('DEL', 'dama:adgeo:GLOBAL', 'dama:adgeo:US', 'dama:adgeo:ET') | Out-Null
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($camp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"active"}'
$serveUS = Invoke-RestMethod "$base/api/v1/ads/serve?country=US"
$serveET = Invoke-RestMethod "$base/api/v1/ads/serve?country=ET"
$usHit = @($serveUS.campaigns) | Where-Object { $_.id -eq $camp.id }
$etHit = @($serveET.campaigns) | Where-Object { $_.id -eq $camp.id }
Add-Result 'ads_geo_redis' ($null -ne $usHit -and $null -eq $etHit) "us=$($null -ne $usHit) et_miss=$($null -eq $etHit)"

# Pin required on create (lat/lng kept for pricing); serve match is country/region/district only (no radius).
$pinCamp = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns" -Headers $h -ContentType 'application/json' -Body (@{
    title       = "pin_$u"
    geo_targets = @(@{ country = 'ET'; lat = 9.03; lng = 38.74 })
    creative_type = 'image'
  } | ConvertTo-Json -Depth 5)
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($pinCamp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"active"}'
$pinServeET = Invoke-RestMethod "$base/api/v1/ads/serve?country=ET"
$pinServeUS = Invoke-RestMethod "$base/api/v1/ads/serve?country=US"
$pinEtHit = @($pinServeET.campaigns) | Where-Object { $_.id -eq $pinCamp.id }
$pinUsHit = @($pinServeUS.campaigns) | Where-Object { $_.id -eq $pinCamp.id }
Add-Result 'ads_geo_pin_country' ($null -ne $pinEtHit -and $null -eq $pinUsHit) "et=$($null -ne $pinEtHit) us_miss=$($null -eq $pinUsHit)"

# District-level geo fence (country/region/district) + required map pin.
$distCamp = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns" -Headers $h -ContentType 'application/json' -Body (@{
    title       = "district_$u"
    geo_targets = @(@{ country = 'ET'; region = 'addis ababa'; district = 'bole'; lat = 9.03; lng = 38.74 })
    creative_type = 'image'
  } | ConvertTo-Json -Depth 5)
Invoke-RedisCli @('DEL', 'dama:adgeo:ET:addis ababa:bole', 'dama:adgeo:ET:addis ababa', 'dama:adgeo:ET') | Out-Null
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($distCamp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"active"}'
$distHit = Invoke-RestMethod "$base/api/v1/ads/serve?country=ET&region=addis%20ababa&district=bole"
$distMiss = Invoke-RestMethod "$base/api/v1/ads/serve?country=ET&region=addis%20ababa&district=kirkos"
$distOk = @($distHit.campaigns) | Where-Object { $_.id -eq $distCamp.id }
$distNo = @($distMiss.campaigns) | Where-Object { $_.id -eq $distCamp.id }
Add-Result 'ads_geo_district' ($null -ne $distOk -and $null -eq $distNo) "hit=$($null -ne $distOk) miss=$($null -eq $distNo)"

# Campaign lifecycle: archive removes from serve; invalid status rejected.
$arch = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($camp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"archived"}'
$serveArch = Invoke-RestMethod "$base/api/v1/ads/serve?country=US"
$archHit = @($serveArch.campaigns) | Where-Object { $_.id -eq $camp.id }
$badStatus = $false
try {
  Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($camp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"deleted"}'
} catch {
  $badStatus = $true
}
Add-Result 'campaign_archive' ($arch.status -eq 'archived' -and $null -eq $archHit -and $badStatus) "status=$($arch.status) serve_miss=$($null -eq $archHit) invalid_rejected=$badStatus"
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/ads/campaigns/$($camp.id)/status" -Headers $h -ContentType 'application/json' -Body '{"status":"active"}'

# Player serve -> impression -> click telemetry loop (placement from DB chrome).
# Fail soft when campaign create did not yield an id so invite/play-rail checks still run.
$campId = [string]$camp.id
if (-not $campId) {
  Add-Result 'ads_impression_click' $false 'campaign_id_missing'
  Add-Result 'ads_unique_reach' $false 'campaign_id_missing'
  Add-Result 'ads_video_complete' $false 'campaign_id_missing'
} else {
  $pbSmoke = Invoke-RestMethod "$base/api/v1/ads/playback"
  $placeLobby = [string]$pbSmoke.player_chrome.placement_lobby
  if (-not $placeLobby) { throw "placement_lobby missing from ads/playback player_chrome" }
  $impBefore = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT impressions FROM ad_campaigns WHERE id='$campId'").ToString().Trim())
  $impRes = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns/$campId/impression" -ContentType 'application/json' -Body (@{ placement = $placeLobby } | ConvertTo-Json)
  $clkRes = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns/$campId/click" -ContentType 'application/json' -Body '{}'
  $impAfter = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT impressions||':'||clicks FROM ad_campaigns WHERE id='$campId'").ToString().Trim().Split(':')[0])
  $clkAfter = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT clicks FROM ad_campaigns WHERE id='$campId'").ToString().Trim())
  Add-Result 'ads_impression_click' (
    $impRes.status -eq 'recorded' -and
    $clkRes.status -eq 'recorded' -and
    $impAfter -gt $impBefore -and
    $clkAfter -ge 1
  ) "imp=$impBefore->$impAfter clk=$clkAfter"

  $vk = "e2e_viewer_$u"
  $null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns/$campId/impression" -ContentType 'application/json' -Body (@{ viewer_key = $vk; placement = $placeLobby } | ConvertTo-Json)
  $null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns/$campId/impression" -ContentType 'application/json' -Body (@{ viewer_key = $vk; placement = $placeLobby } | ConvertTo-Json)
  $reach = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT unique_reach FROM ad_campaigns WHERE id='$campId'").ToString().Trim())
  Add-Result 'ads_unique_reach' ($reach -ge 1) "unique_reach=$reach"
  $vcBefore = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT COALESCE(video_completions,0) FROM ad_campaigns WHERE id='$campId'").ToString().Trim())
  $vcRes = Invoke-RestMethod -Method Post -Uri "$base/api/v1/ads/campaigns/$campId/video-complete" -ContentType 'application/json' -Body '{}'
  $vcAfter = [int]((docker exec dama_postgres psql -U dama -d dama -tAc "SELECT COALESCE(video_completions,0) FROM ad_campaigns WHERE id='$campId'").ToString().Trim())
  Add-Result 'ads_video_complete' ($vcRes.status -eq 'recorded' -and $vcAfter -gt $vcBefore) "vc=$vcBefore->$vcAfter"
}

Invoke-RedisCli @('DEL', 'dama:matchmaking:queue') | Out-Null
$j = Invoke-RestMethod -Method Post -Uri "$base/api/v1/matchmaking/join" -Headers $h -ContentType 'application/json' -Body '{}'
$qlen = [int]((Invoke-RedisCli @('LLEN', 'dama:matchmaking:queue')).ToString().Trim())
Add-Result 'redis_mm' ($j.queued -eq $true -and $qlen -eq 1) "queued=$($j.queued) LLEN=$qlen"

$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/devices/fingerprint" -Headers $h -ContentType 'application/json' -Body (@{ fingerprint = "smoke_$u"; platform = 'web' } | ConvertTo-Json)
Add-Result 'fingerprint' $true 'upserted'

$me = (Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h -ContentType 'application/json' -Body '{"query":"{me{id}}"}').data.me.id
$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/presence/heartbeat" -Headers $h -ContentType 'application/json' -Body '{}'
$pr = Invoke-RestMethod "$base/api/v1/presence?user_id=$me"
Add-Result 'presence' ($pr.online -eq $true) "online=$($pr.online)"
$pub = Invoke-RestMethod "$base/api/v1/players/$me"
Add-Result 'player_online_field' ($pub.online -eq $true -and $pub.player.online -eq $true -and $pub.player.level_label) "online=$($pub.online) level=$($pub.player.level_label)"

try {
  $adminCode = (Invoke-WebRequest "$web/admin/dashboard" -UseBasicParsing).StatusCode
} catch {
  $adminCode = $_.Exception.Response.StatusCode.value__
}
Add-Result 'web_admin_404' ($adminCode -eq 404) "status=$adminCode"

# Receipt ledger requires manual domestic route (geo_payment + ethiopia mode from DB).
$recAdmin = New-E2ESession -Username "e2erec_$([guid]::NewGuid().ToString('N').Substring(0, 8))" -Email "e2erec_$([guid]::NewGuid().ToString('N').Substring(0, 8))@t.test" -Role 'admin'
$recAh = @{ Authorization = "Bearer $($recAdmin.access_token)" }
if (-not $recAh.Authorization -or $recAh.Authorization -eq 'Bearer ') {
  $recTok = $recAdmin.accessToken
  $recAh = @{ Authorization = "Bearer $recTok" }
}
$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/feature-flags" -Headers $recAh -ContentType 'application/json' -Body (@{
    key     = 'ethiopian_payment_mode'
    enabled = $true
    mode    = 'manual_transfer'
  } | ConvertTo-Json)
$rec = Invoke-RestMethod -Method Post -Uri "$base/api/v1/payments/receipts" -Headers $h -ContentType 'application/json' -Body (@{
    amount       = 5
    currency     = 'ETB'
    country_code = 'ET'
    reference    = "smoke_$u"
    receipt_url  = 'https://cdn.example/smoke.png'
  } | ConvertTo-Json)
$dbRec = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT status FROM payment_receipts WHERE id='$($rec.id)'").ToString().Trim()
Add-Result 'receipt_db' ($rec.status -eq 'pending' -and $dbRec -eq 'pending') "id=$($rec.id) db=$dbRec"
$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/feature-flags" -Headers $recAh -ContentType 'application/json' -Body (@{
    key     = 'ethiopian_payment_mode'
    enabled = $true
    mode    = 'local_checkout'
  } | ConvertTo-Json)

# Second player match so game_state exposes player seat IDs for avatar inspection.
$u2 = "e2e2_$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$reg2 = New-E2ESession -Username $u2 -Email "$u2@t.test"
$token2 = $reg2.access_token; if (-not $token2) { $token2 = $reg2.accessToken }
$h2 = @{ Authorization = "Bearer $token2" }
Invoke-RedisCli @('DEL', 'dama:matchmaking:queue') | Out-Null
$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/matchmaking/join" -Headers $h -ContentType 'application/json' -Body '{}'
$j2 = Invoke-RestMethod -Method Post -Uri "$base/api/v1/matchmaking/join" -Headers $h2 -ContentType 'application/json' -Body '{}'
$mgid = $j2.match.game_id
$mst = Invoke-RestMethod "$base/api/v1/games/$mgid/state"
Add-Result 'pvp_seat_ids' ($null -ne $mst.player1_id -and $null -ne $mst.player2_id) "p1=$($mst.player1_id) p2=$($mst.player2_id)"

try {
  $consoleHome = (Invoke-WebRequest "$console/" -UseBasicParsing).StatusCode
} catch {
  $consoleHome = 0
}
Add-Result 'console_standalone' ($consoleHome -eq 200) "status=$consoleHome"

# Mint console session for tournament + VS-AI gate checks (social-only e2e path).
$adminLogin = New-E2ESession -Username $u -Email "$u@t.test" -Role 'admin'
$adminToken = $adminLogin.access_token; if (-not $adminToken) { $adminToken = $adminLogin.accessToken }
$ah = @{ Authorization = "Bearer $adminToken" }
Add-Result 'admin_role' ($adminLogin.user.role -eq 'admin') "role=$($adminLogin.user.role)"
$consoleNav = Invoke-RestMethod -Uri "$base/api/v1/console/nav" -Headers $ah
Add-Result 'console_nav_db' (
  $consoleNav.modules.Count -gt 0 -and
  $consoleNav.modules[0].href -and
  ([string]$consoleNav.brand_title).Trim().Length -gt 0 -and
  ([string]$consoleNav.title_template).Trim().Length -gt 0 -and
  ([string]$consoleNav.meta_description).Trim().Length -gt 0 -and
  ([string]$consoleNav.meta_separator).Trim().Length -gt 0 -and
  ([string]$consoleNav.graphql_empty).Trim().Length -gt 0
) "n=$($consoleNav.modules.Count) brand=$($consoleNav.brand_title)"
$publicNav = Invoke-RestMethod -Uri "$base/api/v1/platform/console-nav"
Add-Result 'platform_console_nav' (
  $publicNav.modules.Count -gt 0 -and
  $publicNav.modules[0].href -and
  ([string]$publicNav.brand_title).Trim().Length -gt 0 -and
  ([string]$publicNav.title_template).Trim().Length -gt 0 -and
  ([string]$publicNav.meta_description).Trim().Length -gt 0 -and
  ([string]$publicNav.meta_separator).Trim().Length -gt 0 -and
  ([string]$publicNav.graphql_empty).Trim().Length -gt 0
) "n=$($publicNav.modules.Count) brand=$($publicNav.brand_title)"
$clientEnums = Invoke-RestMethod -Uri "$base/api/v1/platform/enums"
Add-Result 'client_enums_db' (
  $clientEnums.roles.Count -gt 0 -and
  $clientEnums.console_roles.Count -gt 0 -and
  $clientEnums.publisher_roles.Count -gt 0 -and
  $clientEnums.tournament_statuses.Count -gt 0 -and
  $clientEnums.campaign_statuses.Count -gt 0 -and
  $clientEnums.ethiopia_payment_modes.Count -gt 0 -and
  $clientEnums.default_role -and
  $clientEnums.default_tournament_status -and
  $clientEnums.default_campaign_status -and
  $clientEnums.enrollable_tournament_status -and
  $clientEnums.servable_campaign_status -and
  ([string]$clientEnums.unavailable).Trim().Length -gt 0 -and
  ($clientEnums.campaign_statuses -contains $clientEnums.default_campaign_status) -and
  ($clientEnums.campaign_statuses -contains $clientEnums.servable_campaign_status) -and
  ($clientEnums.tournament_statuses -contains $clientEnums.default_tournament_status) -and
  ($clientEnums.tournament_statuses -contains $clientEnums.enrollable_tournament_status) -and
  ($clientEnums.roles -contains $clientEnums.default_role)
) "roles=$($clientEnums.roles.Count) defaults=$($clientEnums.default_role)/$($clientEnums.default_campaign_status)/$($clientEnums.servable_campaign_status)"
$clientNav = Invoke-RestMethod -Uri "$base/api/v1/platform/client-nav"
Add-Result 'client_nav_db' (
  $clientNav.player.Count -gt 0 -and
  $clientNav.ads.Count -gt 0 -and
  $clientNav.marketing.Count -gt 0 -and
  $clientNav.mobile.Count -gt 0 -and
  $clientNav.dashboard.Count -gt 0 -and
  $clientNav.player[0].route_key -and
  ([string]$clientNav.mobile_nav_unavailable).Trim().Length -gt 0 -and
  ([string]$clientNav.brand_name).Trim().Length -gt 0 -and
  ([string]$clientNav.ads_brand_name).Trim().Length -gt 0 -and
  ([string]$clientNav.marketing_hero_eyebrow).Trim().Length -gt 0 -and
  ([string]$clientNav.marketing_hero_blurb).Trim().Length -gt 0 -and
  ([string]$clientNav.marketing_footer_text).Trim().Length -gt 0 -and
  ([string]$clientNav.site_title_default).Trim().Length -gt 0 -and
  ([string]$clientNav.site_title_template).Trim().Length -gt 0 -and
  ([string]$clientNav.site_description).Trim().Length -gt 0 -and
  ([string]$clientNav.graphql_empty).Trim().Length -gt 0 -and
  ([string]$clientNav.dashboard_page_title).Trim().Length -gt 0 -and
  ([string]$clientNav.dashboard_page_blurb).Trim().Length -gt 0 -and
  ([string]$clientNav.profile_load_failed).Trim().Length -gt 0 -and
  ([string]$clientNav.dashboard_unavailable).Trim().Length -gt 0
) "player=$($clientNav.player.Count) dash=$($clientNav.dashboard.Count) mob=$($clientNav.mobile.Count) brand=$($clientNav.brand_name)"
$ffCat = Invoke-RestMethod -Uri "$base/api/v1/platform/feature-flag-catalog"
Add-Result 'feature_flag_catalog_db' (
  $ffCat.toggles.Count -gt 0 -and
  $ffCat.ai_depths_flag_key -and
  $ffCat.toggles[0].state_field
) "toggles=$($ffCat.toggles.Count) ai_key=$($ffCat.ai_depths_flag_key)"

# Soft deactivate / reactivate (no hard DELETE).
$softU = "soft_$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$softReg = New-E2ESession -Username $softU -Email "$softU@t.test"
$softId = $softReg.user.id
if (-not $softId) { $softId = $softReg.id }
$deact = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/users/$softId/active" -Headers $ah -ContentType 'application/json' -Body '{"active":false}'
Add-Result 'user_soft_deactivate' ($deact.is_active -eq $false) "active=$($deact.is_active)"
$loginBlocked = $false
try {
  New-E2ESession -Username $softU -Email "$softU@t.test" | Out-Null
} catch {
  $loginBlocked = ($_.Exception.Response.StatusCode.value__ -eq 403)
}
Add-Result 'user_login_blocked' $loginBlocked 'disabled_account'
$react = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/users/$softId/active" -Headers $ah -ContentType 'application/json' -Body '{"active":true}'
Add-Result 'user_soft_reactivate' ($react.is_active -eq $true) "active=$($react.is_active)"

# Soft-deactivate must invalidate existing JWTs (Redis disable gate).
$softTok = (New-E2ESession -Username $softU -Email "$softU@t.test").access_token
$softH = @{ Authorization = "Bearer $softTok" }
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/users/$softId/active" -Headers $ah -ContentType 'application/json' -Body '{"active":false}'
$gateBlocked = $false
try {
  Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $softH -ContentType 'application/json' -Body '{"query":"{me{id}}"}' | Out-Null
} catch {
  $gateBlocked = $true
}
if (-not $gateBlocked) {
  $gateResp = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $softH -ContentType 'application/json' -Body '{"query":"{me{id}}"}'
  $gateBlocked = ($null -eq $gateResp.data.me) -or ($null -ne $gateResp.errors)
}
Add-Result 'user_jwt_disabled_gate' $gateBlocked 'existing_jwt_rejected'
$null = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/users/$softId/active" -Headers $ah -ContentType 'application/json' -Body '{"active":true}'

$freeCreate = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $ah -ContentType 'application/json' -Body (@{
    query     = 'mutation($t:String!){createTournament(title:$t,isFree:true,entryFeeAmount:50,entryFeeCurrency:"USD"){id isFree entryFeeAmount}}'
    variables = @{ t = "free_$u" }
  } | ConvertTo-Json -Depth 5)
$freeT = $freeCreate.data.createTournament
Add-Result 'is_free_create' ($freeT.isFree -eq $true -and [double]$freeT.entryFeeAmount -eq 0) "fee=$($freeT.entryFeeAmount)"
# Paid tournament with zero fee must fail (no silent free via fee<=0).
$paidZeroDenied = $false
try {
  $badPaid = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $ah -ContentType 'application/json' -Body (@{
      query = 'mutation($t:String!){createTournament(title:$t,isFree:false,entryFeeAmount:0,entryFeeCurrency:"USD"){id isFree entryFeeAmount}}'
      variables = @{ t = "paid_zero_$u" }
    } | ConvertTo-Json -Depth 5)
  if ($badPaid.errors) { $paidZeroDenied = $true }
} catch {
  $paidZeroDenied = $true
}
Add-Result 'paid_zero_fee_rejected' $paidZeroDenied 'paid+fee0 must fail'
$dbFree = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT is_free::text||':'||entry_fee_amount::text FROM tournaments WHERE id='$($freeT.id)'").ToString().Trim()
Add-Result 'is_free_db' ($dbFree -eq 'true:0.00' -or $dbFree -eq 't:0.00') "db=$dbFree"

$openFree = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/tournaments/$($freeT.id)/status" -Headers $ah -ContentType 'application/json' -Body '{"status":"open"}'
Add-Result 'is_free_open' ([string]$openFree.status -eq 'open') "status=$($openFree.status)"
$enroll = Invoke-RestMethod -Method Post -Uri "$base/api/v1/tournaments/$($freeT.id)/enroll" -Headers $h2 -ContentType 'application/json' -Body '{}'
Add-Result 'is_free_enroll' ([double]$enroll.charged -eq 0 -and $enroll.is_free -eq $true) "charged=$($enroll.charged)"
$dbEntry = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT entry_fee_charged::text||':'||is_free::text FROM tournament_entries WHERE id='$($enroll.entry.id)'").ToString().Trim()
Add-Result 'entry_db' ($dbEntry -eq '0.00:true' -or $dbEntry -match '^0(\.0+)?:(true|t)$') "db=$dbEntry"
$u2id = (Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $h2 -ContentType 'application/json' -Body '{"query":"{me{id}}"}').data.me.id
$pubPlace = Invoke-RestMethod "$base/api/v1/players/$u2id"
$placeHit = @($pubPlace.tournament_placements) | Where-Object { $_.tournament_id -eq $freeT.id }
Add-Result 'player_tournament_placements' ($null -ne $placeHit) "n=$(@($pubPlace.tournament_placements).Count)"

$walUS = Invoke-RestMethod -Method Get -Uri "$base/api/v1/payments/wallet?country_code=US" -Headers $h2
$walET = Invoke-RestMethod -Method Get -Uri "$base/api/v1/payments/wallet?country_code=ET" -Headers $h2
Add-Result 'wallet_geo' ($walUS.currency -eq 'USD' -and $walET.currency -eq 'ETB') "US=$($walUS.currency) ET=$($walET.currency)"

$beforeClock = $prog.match_clock.initial_seconds
$consoleProg = Invoke-RestMethod -Method Get -Uri "$base/api/v1/console/progression" -Headers $ah
$beforeUnit = [double]$consoleProg.ad_pricing.impression_unit_cost
$beforeEtFee = [double]$consoleProg.ad_pricing.campaign_create_fee_ethiopia_amount
$beforeGlFee = [double]$consoleProg.ad_pricing.campaign_create_fee_global_amount
$beforeEtCur = [string]$consoleProg.ad_pricing.campaign_create_fee_ethiopia_currency
$beforeGlCur = [string]$consoleProg.ad_pricing.campaign_create_fee_global_currency
Add-Result 'progression_console_dual_fees_get' (
  $beforeUnit -gt 0 -and
  $beforeEtFee -gt 0 -and
  $beforeGlFee -gt 0 -and
  $beforeEtCur -eq 'ETB' -and
  $beforeGlCur -eq 'USD'
) "et=$beforeEtFee $beforeEtCur gl=$beforeGlFee $beforeGlCur"
$putProg = Invoke-RestMethod -Method Put -Uri "$base/api/v1/console/progression" -Headers $ah -ContentType 'application/json' -Body (@{
    xp_levels = $prog.xp_levels
    match_clock = @{
      enabled            = $true
      initial_seconds    = [int]$beforeClock
      increment_seconds  = [int]$prog.match_clock.increment_seconds
      invite_ttl_seconds = [int]$prog.match_clock.invite_ttl_seconds
    }
    ad_pricing = @{
      impression_unit_cost                    = $beforeUnit
      campaign_create_fee_ethiopia_amount     = $beforeEtFee
      campaign_create_fee_ethiopia_currency   = $beforeEtCur
      campaign_create_fee_global_amount       = $beforeGlFee
      campaign_create_fee_global_currency     = $beforeGlCur
    }
  } | ConvertTo-Json -Depth 6)
Add-Result 'progression_console' (
  $putProg.match_clock.initial_seconds -eq $beforeClock -and
  $putProg.xp_levels.Count -gt 0 -and
  [double]$putProg.ad_pricing.impression_unit_cost -eq $beforeUnit -and
  [double]$putProg.ad_pricing.campaign_create_fee_ethiopia_amount -eq $beforeEtFee -and
  [double]$putProg.ad_pricing.campaign_create_fee_global_amount -eq $beforeGlFee -and
  $putProg.ad_pricing.campaign_create_fee_ethiopia_currency -eq 'ETB' -and
  $putProg.ad_pricing.campaign_create_fee_global_currency -eq 'USD'
) "clock=$($putProg.match_clock.initial_seconds) unit=$($putProg.ad_pricing.impression_unit_cost) et=$($putProg.ad_pricing.campaign_create_fee_ethiopia_amount) gl=$($putProg.ad_pricing.campaign_create_fee_global_amount)"
$pubAfter = Invoke-RestMethod "$base/api/v1/progression"
Add-Result 'progression_public_sync' ($pubAfter.match_clock.initial_seconds -eq $beforeClock) "clock=$($pubAfter.match_clock.initial_seconds)"
$priceAfterET = Invoke-RestMethod "$base/api/v1/ads/pricing?lat=9.03&lng=38.74"
$priceAfterUS = Invoke-RestMethod "$base/api/v1/ads/pricing?lat=40.7128&lng=-74.0060"
Add-Result 'ad_pricing_console_sync' (
  [double]$priceAfterET.impression_unit_cost -eq $beforeUnit -and
  [double]$priceAfterET.campaign_create_fee_amount -eq $beforeEtFee -and
  $priceAfterET.campaign_create_fee_currency -eq 'ETB' -and
  [double]$priceAfterUS.campaign_create_fee_amount -eq $beforeGlFee -and
  $priceAfterUS.campaign_create_fee_currency -eq 'USD'
) "et=$($priceAfterET.campaign_create_fee_amount) $($priceAfterET.campaign_create_fee_currency) gl=$($priceAfterUS.campaign_create_fee_amount) $($priceAfterUS.campaign_create_fee_currency)"

$curBefore = Invoke-RestMethod "$base/api/v1/payments/currency"
$putCur = Invoke-RestMethod -Method Put -Uri "$base/api/v1/console/currency" -Headers $ah -ContentType 'application/json' -Body (@{
    global    = $curBefore.global
    ethiopia  = $curBefore.ethiopia
    supported = $curBefore.supported
  } | ConvertTo-Json -Depth 5)
Add-Result 'currency_console' (
  $putCur.global -eq $curBefore.global -and
  $putCur.ethiopia -eq $curBefore.ethiopia
) "global=$($putCur.global) et=$($putCur.ethiopia)"
$curAfter = Invoke-RestMethod "$base/api/v1/payments/currency"
Add-Result 'currency_public_sync' (
  $curAfter.global -eq $curBefore.global -and
  $curAfter.ethiopia -eq $curBefore.ethiopia -and
  (Invoke-RestMethod "$base/api/v1/payments/route?country_code=US").currency -eq $curAfter.global -and
  (Invoke-RestMethod "$base/api/v1/payments/route?country_code=ET").currency -eq $curAfter.ethiopia
) "US=$($curAfter.global) ET=$($curAfter.ethiopia)"

$flagsBefore = Invoke-RestMethod "$base/api/v1/feature-flags"
$depthsBefore = @($flagsBefore.ai_depths)
Add-Result 'ai_depths_loaded' ($depthsBefore.Count -ge 1) "depths=$($depthsBefore -join ',')"
$putDepths = Invoke-RestMethod -Method Post -Uri "$base/api/v1/feature-flags" -Headers $ah -ContentType 'application/json' -Body (@{
    key     = 'vs_ai_practice_mode'
    enabled = $true
    depths  = $depthsBefore
  } | ConvertTo-Json -Depth 5)
Add-Result 'ai_depths_console' (
  (@($putDepths.ai_depths) -join ',') -eq ($depthsBefore -join ',')
) "depths=$($putDepths.ai_depths -join ',')"

$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/feature-flags" -Headers $ah -ContentType 'application/json' -Body (@{
    key     = 'vs_ai_practice_mode'
    enabled = $false
    depths  = $depthsBefore
  } | ConvertTo-Json -Depth 5)
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/games/start" -Headers $ah -ContentType 'application/json' -Body '{"mode":"ai","ai_search_depth":2}'
  $aiOff = 200
} catch {
  $aiOff = $_.Exception.Response.StatusCode.value__
}
Add-Result 'vs_ai_off_403' ($aiOff -eq 403) "status=$aiOff"
$null = Invoke-RestMethod -Method Post -Uri "$base/api/v1/feature-flags" -Headers $ah -ContentType 'application/json' -Body (@{
    key     = 'vs_ai_practice_mode'
    enabled = $true
    depths  = $depthsBefore
  } | ConvertTo-Json -Depth 5)

$prizeTitle = "prize_$u"
$gqlPrize = @{
  query = 'mutation($title:String!,$currency:String!,$prize:Float!){ createTournament(title:$title,isFree:true,entryFeeAmount:0,entryFeeCurrency:$currency,prizePoolAmount:$prize,prizePoolCurrency:$currency){ id isFree prizePoolAmount prizePoolCurrency status } }'
  variables = @{
    title    = $prizeTitle
    currency = $curAfter.global
    prize    = 100.0
  }
} | ConvertTo-Json -Depth 6
$prizeRes = Invoke-RestMethod -Method Post -Uri "$base/graphql" -Headers $ah -ContentType 'application/json' -Body $gqlPrize
$prizeT = $prizeRes.data.createTournament
Add-Result 'prize_pool_create' (
  $null -ne $prizeT -and
  [bool]$prizeT.isFree -eq $true -and
  [double]$prizeT.prizePoolAmount -eq 100
) "id=$($prizeT.id) prize=$($prizeT.prizePoolAmount)"
if ($prizeT.id) {
  $prizeDb = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT prize_pool->>'total' FROM tournaments WHERE id='$($prizeT.id)'").ToString().Trim()
  Add-Result 'prize_pool_db' ($prizeDb -eq '100') "db=$prizeDb"
  $openT = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/tournaments/$($prizeT.id)/status" -Headers $ah -ContentType 'application/json' -Body '{"status":"open"}'
  Add-Result 'tournament_status_open' ([string]$openT.status -eq 'open') "status=$($openT.status)"
  $archT = Invoke-RestMethod -Method Patch -Uri "$base/api/v1/console/tournaments/$($prizeT.id)/status" -Headers $ah -ContentType 'application/json' -Body '{"status":"archived"}'
  Add-Result 'tournament_status_archive' ([string]$archT.status -eq 'archived') "status=$($archT.status)"
  $statusDb = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT status FROM tournaments WHERE id='$($prizeT.id)'").ToString().Trim()
  Add-Result 'tournament_status_db' ($statusDb -eq 'archived') "db=$statusDb"
} else {
  Add-Result 'prize_pool_db' $false 'missing tournament id'
  Add-Result 'tournament_status_open' $false 'missing tournament id'
  Add-Result 'tournament_status_archive' $false 'missing tournament id'
  Add-Result 'tournament_status_db' $false 'missing tournament id'
}

$adsDb = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT title FROM ad_campaigns WHERE id='$($camp.id)'").ToString().Trim()
Add-Result 'ads_db' ($adsDb -eq "cap_$u") "db=$adsDb"

$boardRules = Invoke-RestMethod "$base/api/v1/game/rules"
Add-Result 'board_rules_public' (
  [int]$boardRules.size -gt 0 -and
  [int]$boardRules.pieces_per_side -gt 0 -and
  [int]$boardRules.setup_rows -gt 0 -and
  -not [string]::IsNullOrWhiteSpace([string]$boardRules.variant)
) "size=$($boardRules.size) variant=$($boardRules.variant)"
$putBoard = Invoke-RestMethod -Method Put -Uri "$base/api/v1/console/game-rules" -Headers $ah -ContentType 'application/json' -Body (@{
    size            = $boardRules.size
    pieces_per_side = $boardRules.pieces_per_side
    setup_rows      = $boardRules.setup_rows
    variant         = $boardRules.variant
  } | ConvertTo-Json)
Add-Result 'board_rules_console' (
  [int]$putBoard.size -eq [int]$boardRules.size -and
  [string]$putBoard.variant -eq [string]$boardRules.variant
) "size=$($putBoard.size)"

$modBefore = Invoke-RestMethod -Uri "$base/api/v1/console/moderation" -Headers $ah
$putMod = Invoke-RestMethod -Method Put -Uri "$base/api/v1/console/moderation" -Headers $ah -ContentType 'application/json' -Body (@{
    provider = $modBefore.provider
    enabled  = [bool]$modBefore.enabled
  } | ConvertTo-Json)
Add-Result 'moderation_console' (
  [string]$putMod.provider -eq [string]$modBefore.provider
) "provider=$($putMod.provider) enabled=$($putMod.enabled)"

$chLabel = "yt_$u"
$regCh = Invoke-RestMethod -Method Post -Uri "$base/api/v1/media/pool/channels" -Headers $ah -ContentType 'application/json' -Body (@{
    channel_id        = "UC_e2e_$u"
    label             = $chLabel
    client_id         = "cid_$u"
    client_secret     = "sec_$u"
    refresh_token     = "ref_$u"
    api_key           = "key_$u"
    daily_quota_limit = 3
  } | ConvertTo-Json)
Add-Result 'media_pool_register' (
  $null -ne $regCh.id -and
  [string]$regCh.label -eq $chLabel -and
  $null -eq $regCh.client_id -and
  $null -eq $regCh.client_secret -and
  $null -eq $regCh.refresh_token -and
  $null -eq $regCh.api_key
) "id=$($regCh.id) secrets_omitted=True"
$chDb = (docker exec dama_postgres psql -U dama -d dama -tAc "SELECT label FROM youtube_channels WHERE id='$($regCh.id)'").ToString().Trim()
Add-Result 'media_pool_db' ($chDb -eq $chLabel) "db=$chDb"
$mpTest = Invoke-RestMethod -Method Post -Uri "$base/api/v1/media/pool/channels/$($regCh.id)/test" -Headers $ah -ContentType 'application/json' -Body '{}'
Add-Result 'media_pool_test' ($mpTest.id -eq $regCh.id -and ($mpTest.ready -eq $true -or $null -ne $mpTest.error -or $mpTest.ready -eq $false)) "ready=$($mpTest.ready)"

# Direct match invite (REST create + accept -> seated PvP game).
$u2 = "e2e2_" + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$reg2 = New-E2ESession -Username $u2 -Email "$u2@t.test"
$token2 = $reg2.access_token; if (-not $token2) { $token2 = $reg2.accessToken }
$h2inv = @{ Authorization = "Bearer $token2" }
# Restore player role for invite flow (player e2e session).
docker exec dama_postgres psql -U dama -d dama -c "UPDATE users SET role='player' WHERE id='$me'" | Out-Null
$login1 = New-E2ESession -Username $u -Email "$u@t.test"
$t1 = $login1.access_token; if (-not $t1) { $t1 = $login1.accessToken }
$h1inv = @{ Authorization = "Bearer $t1" }
# Fail-closed create: rated + preferred_color + match_clock.presets TC required.
$prog = Invoke-RestMethod -Method Get -Uri "$base/api/v1/progression" -TimeoutSec 20
$tcPresets = @($prog.match_clock.presets)
$tcA = 0; $tcB = 0
if ($tcPresets.Count -ge 1) { $tcA = [int]$tcPresets[0].seconds }
if ($tcPresets.Count -ge 2) { $tcB = [int]$tcPresets[1].seconds } else { $tcB = $tcA }
Add-Result 'match_clock_presets' ($tcA -gt 0) "tcA=$tcA tcB=$tcB"
$invCreate = Invoke-RestMethod -Method Post -Uri "$base/api/v1/invites/" -Headers $h1inv -ContentType 'application/json' -Body (@{
    to_user = $u2
    rated = $true
    preferred_color = 'random'
    time_control_seconds = $tcA
  } | ConvertTo-Json)
$invId = $invCreate.invite.id
Add-Result 'invite_create' (
  $null -ne $invId -and
  [string]$invCreate.invite.status -eq 'pending' -and
  [bool]$invCreate.invite.rated -eq $true -and
  [string]$invCreate.invite.preferred_color -eq 'random' -and
  [int]$invCreate.invite.time_control_seconds -eq $tcA
) "id=$invId tc=$($invCreate.invite.time_control_seconds)"
$invAccept = Invoke-RestMethod -Method Post -Uri "$base/api/v1/invites/$invId/accept" -Headers $h2inv -ContentType 'application/json' -Body '{}'
Add-Result 'invite_accept' (
  [string]$invAccept.invite.status -eq 'accepted' -and
  $null -ne $invAccept.match.game_id -and
  $null -ne $invAccept.match.player1_id -and
  $null -ne $invAccept.match.player2_id
) "game=$($invAccept.match.game_id)"
# Double-accept must fail (SETNX / status claim).
$doubleAcceptBlocked = $false
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/invites/$invId/accept" -Headers $h2inv -ContentType 'application/json' -Body '{}' | Out-Null
} catch {
  $doubleAcceptBlocked = ($_.Exception.Response.StatusCode.value__ -ge 400)
}
Add-Result 'invite_accept_idempotent' $doubleAcceptBlocked 'second accept rejected'
# Challenge link (open invite) + accept-by-token.
$linkCreate = Invoke-RestMethod -Method Post -Uri "$base/api/v1/invites/" -Headers $h1inv -ContentType 'application/json' -Body (@{
    open_link = $true
    rated = $false
    preferred_color = 'white'
    time_control_seconds = $tcB
  } | ConvertTo-Json)
$shareTok = [string]$linkCreate.invite.share_token
Add-Result 'invite_challenge_link' (
  [string]$linkCreate.invite.status -eq 'pending' -and
  $shareTok.Length -gt 8 -and
  [bool]$linkCreate.invite.rated -eq $false
) "token_len=$($shareTok.Length)"
$linkAccept = Invoke-RestMethod -Method Post -Uri "$base/api/v1/invites/token/$shareTok/accept" -Headers $h2inv -ContentType 'application/json' -Body '{}'
Add-Result 'invite_accept_by_token' (
  [string]$linkAccept.invite.status -eq 'accepted' -and
  $null -ne $linkAccept.match.game_id -and
  [bool]$linkAccept.invite.rated -eq $false
) "game=$($linkAccept.match.game_id)"
# Play-rail chrome + friends + live games + players search (DB-driven, fail-closed).
$rail = Invoke-RestMethod -Method Get -Uri "$base/api/v1/public/play-rail-chrome" -TimeoutSec 20
Add-Result 'play_rail_chrome' (
  [bool]$rail.tab_new_game -and [bool]$rail.tab_games -and [bool]$rail.tab_players -and
  [bool]$rail.label_rated -and [bool]$rail.label_unrated -and
  [bool]$rail.aria_color_white -and [bool]$rail.aria_color_black -and [bool]$rail.aria_color_random -and
  [bool]$rail.meta_separator -and [bool]$rail.stats_separator -and
  [bool]$rail.wins_abbr -and [bool]$rail.losses_abbr -and
  [bool]$rail.mode_ai -and [bool]$rail.mode_pvp -and
  [bool]$rail.rating_paren_open -and [bool]$rail.rating_paren_close -and
  [bool]$rail.online_label -and [bool]$rail.playing_label -and [bool]$rail.offline_label -and
  [bool]$rail.copied_action -and [bool]$rail.challenge_link_action -and [bool]$rail.copied_share_blurb -and
  (-not ([string]$rail.copied_share_blurb -match '15\s*minute')) -and
  [bool]$rail.remove_friend_action -and [bool]$rail.sub_watch -and [bool]$rail.sub_history -and
  [bool]$rail.match_result_win_on_time_aria -and [bool]$rail.match_result_loss_on_time_aria -and
  [bool]$rail.match_result_draw_on_time_aria -and
  ([string]$rail.match_result_win_on_time_aria -match '(?i)on\s*time') -and
  ([string]$rail.match_result_loss_on_time_aria -match '(?i)on\s*time') -and
  ([string]$rail.match_result_draw_on_time_aria -match '(?i)on\s*time') -and
  ([string]$rail.match_result_win_on_time_aria -ne [string]$rail.match_result_win_aria) -and
  ([string]$rail.match_result_loss_on_time_aria -ne [string]$rail.match_result_loss_aria) -and
  ([string]$rail.match_result_draw_on_time_aria -ne [string]$rail.match_result_draw_aria)
) 'tabs+rated+color+mig107/108+presence+copy+friends+watch+on-time-aria'
$friends = Invoke-RestMethod -Method Get -Uri "$base/api/v1/friends/" -Headers $h1inv -TimeoutSec 20
Add-Result 'friends_list' ($null -ne $friends.friends) "count=$(@($friends.friends).Count)"
$live = Invoke-RestMethod -Method Get -Uri "$base/api/v1/games/live" -Headers $h1inv -TimeoutSec 20
Add-Result 'live_games_feed' ($null -ne $live.games) "count=$(@($live.games).Count)"
$players = Invoke-RestMethod -Method Get -Uri "$base/api/v1/players?q=$u2&skip=0&limit=40" -Headers $h1inv -TimeoutSec 20
Add-Result 'players_search' ($null -ne $players.players) "count=$(@($players.players).Count)"
$hist = Invoke-RestMethod -Method Get -Uri "$base/api/v1/matches/me" -Headers $h1inv -TimeoutSec 20
Add-Result 'matches_history' ($null -ne $hist.matches) "count=$(@($hist.matches).Count)"

# Payout: primary phone required on method before request.
$payoutBlocked = $false
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/v1/payouts/request" -Headers $h1inv -ContentType 'application/json' -Body (@{ amount = 1; currency = 'USD' } | ConvertTo-Json) | Out-Null
} catch {
  $payoutBlocked = ($_.Exception.Response.StatusCode.value__ -eq 400)
}
Add-Result 'payout_phone_required' $payoutBlocked 'missing_method'
$method = Invoke-RestMethod -Method Put -Uri "$base/api/v1/payouts/method" -Headers $h1inv -ContentType 'application/json' -Body (@{
    provider = 'telebirr'; account_name = $u; phone = '+251911000000'
  } | ConvertTo-Json)
Add-Result 'payout_method_saved' ($method.phone -eq '+251911000000' -and $method.provider -eq 'telebirr') "phone=$($method.phone)"
docker exec dama_postgres psql -U dama -d dama -c "INSERT INTO wallets (user_id, currency, balance, updated_at) VALUES ('$me','USD',25,NOW()) ON CONFLICT (user_id, currency) DO UPDATE SET balance = 25, updated_at = NOW()" | Out-Null
$payoutReq = Invoke-RestMethod -Method Post -Uri "$base/api/v1/payouts/request" -Headers $h1inv -ContentType 'application/json' -Body (@{ amount = 5; currency = 'USD' } | ConvertTo-Json)
Add-Result 'payout_request' ($payoutReq.status -eq 'pending' -and $payoutReq.phone -eq '+251911000000') "id=$($payoutReq.id)"

# Cloudinary avatar upload (requires CLOUDINARY_* + DAMA_MEDIA_PUBLIC_BASE in API env).
$pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
$pngPath = Join-Path $env:TEMP ("dama_e2e_avatar_{0}.png" -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String($pngB64))
$cdnOut = & curl.exe -s -X POST "$base/api/v1/avatars/upload" -H "Authorization: Bearer $t1" -F "file=@$pngPath;type=image/png"
Remove-Item -Force $pngPath -ErrorAction SilentlyContinue
$cdnOk = $cdnOut -match 'avatar' -and $cdnOut -match 'thumb_url' -and $cdnOut -notmatch '"error"'
Add-Result 'cloudinary_avatar' $cdnOk ($(if ($cdnOk) { 'thumb+full' } else { 'upload_failed' }))

docker exec dama_postgres psql -U dama -d dama -c "UPDATE users SET role='player' WHERE id='$me'" | Out-Null

$results | Format-Table -AutoSize
$pass = @($results | Where-Object ok).Count
$fail = @($results | Where-Object { -not $_.ok }).Count
Write-Host "PASS=$pass FAIL=$fail TOTAL=$($results.Count)"
$results | Where-Object { -not $_.ok } | ForEach-Object { Write-Host "FAIL: $($_.name) => $($_.detail)" }
if ($fail -gt 0) { exit 1 }
