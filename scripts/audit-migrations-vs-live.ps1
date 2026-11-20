# Compare local apps/api/migrations/*.sql effects against live Postgres.
# Dama has no schema_migrations table - Migrate() re-applies every *.sql idempotently.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$migDir = Join-Path $root 'apps\api\migrations'
$envFile = Join-Path $root '.env'
$raw = Get-Content $envFile | Where-Object { $_ -match '^DAMA_DATABASE_URL=' } | Select-Object -First 1
if (-not $raw) { $raw = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1 }
if (-not $raw) { throw 'DAMA_DATABASE_URL / DATABASE_URL missing from .env' }
$url = $raw -replace '^[^=]+=', ''

$local = @(Get-ChildItem (Join-Path $migDir '*.sql') | Sort-Object Name | ForEach-Object { $_.Name })
Write-Host "LOCAL_MIGRATION_COUNT=$($local.Count)"
Write-Host "LOCAL_FIRST=$($local[0])"
Write-Host "LOCAL_LAST=$($local[-1])"

$probes = @(
  @{ m = '001_init.sql'; q = "SELECT CASE WHEN to_regclass('public.users') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '004_xp_levels_and_match_clock.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='xp_levels') THEN 1 ELSE 0 END" }
  @{ m = '006_board_rules.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='board_rules') THEN 1 ELSE 0 END" }
  @{ m = '017_google_oauth.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='supabase_user_id') THEN 1 ELSE 0 END" }
  @{ m = '018_social_only_and_payout_phone.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_payout_methods' AND column_name='phone') THEN 1 ELSE 0 END" }
  @{ m = '025_rbac_permissions_and_ad_runtime.sql'; q = "SELECT CASE WHEN to_regclass('public.rbac_permissions') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '037_play_matchmaking_chrome.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='play_chrome') THEN 1 ELSE 0 END" }
  @{ m = '038_tournament_and_lobby_chrome.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='tournament_chrome') THEN 1 ELSE 0 END" }
  @{ m = '043_mobile_wallet_profile_board_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'top_up_amount_label' FROM platform_settings WHERE key='wallet_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '056_tournament_ads_media_home_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'amount_label' FROM platform_settings WHERE key='payment_modal_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '062_cash_rmg_compliance.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='cash_rmg_chrome') THEN 1 ELSE 0 END" }
  @{ m = '067_document_kyc_payout.sql'; q = "SELECT CASE WHEN to_regclass('public.kyc_document_submissions') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '069_document_kyc_number_expiry.sql'; q = "SELECT CASE WHEN to_regclass('public.kyc_document_submissions') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '070_document_kyc_issuing_country.sql'; q = "SELECT CASE WHEN to_regclass('public.kyc_document_submissions') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '071_document_kyc_issue_date.sql'; q = "SELECT CASE WHEN to_regclass('public.kyc_document_submissions') IS NOT NULL THEN 1 ELSE 0 END" }
  @{ m = '293_drop_kyc_document_metadata_fields.sql'; q = "SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='kyc_document_submissions' AND column_name='document_number') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='kyc_document_submissions' AND column_name='document_issued_on') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='kyc_document_submissions' AND column_name='document_expires_on') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='kyc_document_submissions' AND column_name='document_country_code') THEN 1 ELSE 0 END" }
  @{ m = '073_pagination_chrome.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key='pagination_chrome') THEN 1 ELSE 0 END" }
  @{ m = '074_wallet_crud_pending_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'top_up_pending' FROM platform_settings WHERE key='wallet_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '077_play_game_over_stop_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'game_over_title' FROM platform_settings WHERE key='play_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '079_play_abandon_nav_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'nav_continue_label' FROM platform_settings WHERE key='play_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '081_upload_pending_spectate_live_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'thumbnail_upload_pending' FROM platform_settings WHERE key='tournament_chrome'),'') <> '' AND COALESCE((SELECT value->>'live_label' FROM platform_settings WHERE key='spectate_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '082_ops_table_selection_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->'avatars'->>'select_all_label' FROM platform_settings WHERE key='admin_console_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '083_users_media_pool_selection_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->'users'->>'select_all_label' FROM platform_settings WHERE key='admin_console_chrome'),'') <> '' AND COALESCE((SELECT value->'media_pool'->>'select_all_label' FROM platform_settings WHERE key='admin_console_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '084_users_column_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->'users'->>'col_user_label' FROM platform_settings WHERE key='admin_console_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '085_amount_placeholders_chrome.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'amount_placeholder' FROM platform_settings WHERE key='payment_modal_chrome'),'') <> '' AND COALESCE((SELECT value->>'top_up_amount_placeholder' FROM platform_settings WHERE key='wallet_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '533_hosted_events_prize_media.sql'; q = "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hosted_events' AND column_name='prize_image_url') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hosted_events' AND column_name='gallery') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hosted_events' AND column_name='description') AND COALESCE((SELECT value->>'detail_description_label' FROM platform_settings WHERE key='events_player_chrome'),'') <> '' AND COALESCE((SELECT value->>'description_label' FROM platform_settings WHERE key='events_organizer_chrome'),'') <> '' AND COALESCE((SELECT value->>'gallery_max_slots' FROM platform_settings WHERE key='events_organizer_chrome'),'') = '9' AND COALESCE((SELECT value->>'detail_prize_image_label' FROM platform_settings WHERE key='events_admin_chrome'),'') <> '' AND COALESCE((SELECT value->>'detail_gallery_label' FROM platform_settings WHERE key='events_admin_chrome'),'') <> '' THEN 1 ELSE 0 END" }
  @{ m = '534_admin_hosted_list_prize_thumb.sql'; q = "SELECT CASE WHEN COALESCE((SELECT value->>'thumbnail_label' FROM platform_settings WHERE key='events_admin_chrome'),'') <> '' AND lower(COALESCE((SELECT value->>'thumbnail_label' FROM platform_settings WHERE key='events_admin_chrome'),'')) NOT IN ('event logo','logo') AND COALESCE((SELECT value->>'thumbnail_label' FROM platform_settings WHERE key='events_admin_chrome'),'') <> COALESCE((SELECT value->>'detail_logo_label' FROM platform_settings WHERE key='events_admin_chrome'),'') THEN 1 ELSE 0 END" }
)

$tmpSql = [System.IO.Path]::GetTempFileName() + '.sql'
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('\pset tuples_only on')
[void]$sb.AppendLine('\pset format unaligned')
foreach ($p in $probes) {
  [void]$sb.AppendLine(("SELECT '{0}' || '=' || ({1});" -f $p.m, $p.q))
}
[System.IO.File]::WriteAllText($tmpSql, $sb.ToString())

$out = docker run --rm -v "${tmpSql}:/probe.sql:ro" postgres:16-alpine psql "$url" -f /probe.sql 2>&1
Remove-Item $tmpSql -Force

$missing = @()
$present = @()
foreach ($line in ($out -split "`n")) {
  $t = "$line".Trim()
  if ($t -notmatch '^[0-9]{3}_.+=[01]$') { continue }
  $parts = $t -split '=', 2
  $name = $parts[0]
  $val = $parts[1]
  if ($val -eq '1') { $present += $name } else { $missing += $name; Write-Host "MISSING_MARKER $name" }
}
Write-Host "MARKER_PRESENT=$($present.Count)/$($probes.Count)"
Write-Host "MARKER_MISSING=$($missing.Count)"
if ($missing.Count -eq 0) { Write-Host 'ALL_PROBED_MARKERS_PRESENT' } else { Write-Host ("MISSING_LIST=" + ($missing -join ',')) }

$keysSql = [System.IO.Path]::GetTempFileName() + '.sql'
[System.IO.File]::WriteAllText($keysSql, "SELECT count(*)::text FROM platform_settings;")
$keyOut = docker run --rm -v "${keysSql}:/k.sql:ro" postgres:16-alpine psql "$url" -t -A -f /k.sql 2>&1
Remove-Item $keysSql -Force
Write-Host "PLATFORM_SETTINGS_COUNT=$keyOut"

if ($missing.Count -gt 0) { exit 2 }
exit 0
