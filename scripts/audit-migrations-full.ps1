# Full local-vs-Docker-vs-live migration audit.
# Dama has no schema_migrations table - Migrate() re-executes every *.sql idempotently.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$migDir = Join-Path $root 'apps\api\migrations'
$envFile = Join-Path $root '.env'

$local = @(Get-ChildItem (Join-Path $migDir '*.sql') | Sort-Object Name | ForEach-Object { $_.Name })
Write-Host "LOCAL_MIGRATION_COUNT=$($local.Count)"
Write-Host "LOCAL_FIRST=$($local[0])"
Write-Host "LOCAL_LAST=$($local[-1])"

# --- Container file parity ---
$container = @(docker exec dama_backend_api sh -c "ls /app/migrations/*.sql" 2>&1 |
  ForEach-Object { ($_ -split '/')[-1] } | Where-Object { $_ -match '\.sql$' } | Sort-Object)
Write-Host "CONTAINER_MIGRATION_COUNT=$($container.Count)"
$onlyLocal = @(Compare-Object $local $container | Where-Object SideIndicator -eq '<=' | ForEach-Object InputObject)
$onlyCont = @(Compare-Object $local $container | Where-Object SideIndicator -eq '=>' | ForEach-Object InputObject)
if ($onlyLocal.Count -or $onlyCont.Count) {
  Write-Host ("FILE_ONLY_LOCAL=" + ($onlyLocal -join ','))
  Write-Host ("FILE_ONLY_CONTAINER=" + ($onlyCont -join ','))
} else {
  Write-Host 'FILE_PARITY=ok'
}

# Effect probes covering early + mid + recent migrations (schema + chrome).
# Single-quoted PowerShell strings (avoid $-expansion). Postgres E'' escapes for apostrophes.
$probes = @(
  @{ m = '001_init.sql'; q = 'SELECT CASE WHEN to_regclass(''public.users'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '004_xp_levels_and_match_clock.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key = ''xp_levels'') THEN 1 ELSE 0 END' }
  @{ m = '017_google_oauth.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''users'' AND column_name = ''supabase_user_id'') THEN 1 ELSE 0 END' }
  @{ m = '025_rbac_permissions_and_ad_runtime.sql'; q = 'SELECT CASE WHEN to_regclass(''public.rbac_permissions'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '062_cash_rmg_compliance.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM platform_settings WHERE key = ''cash_rmg_chrome'') THEN 1 ELSE 0 END' }
  @{ m = '067_document_kyc_payout.sql'; q = 'SELECT CASE WHEN to_regclass(''public.kyc_document_submissions'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '182_hosted_events.sql'; q = 'SELECT CASE WHEN to_regclass(''public.hosted_events'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '255_hosted_events_multi_format_result_payout.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''hosted_events'' AND column_name = ''result_payout_format'') OR to_regclass(''public.hosted_events'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '286_user_payout_methods_multi_and_wallet_bank_chrome.sql'; q = 'SELECT CASE WHEN to_regclass(''public.user_payout_methods'') IS NOT NULL THEN 1 ELSE 0 END' }
  @{ m = '293_drop_kyc_document_metadata_fields.sql'; q = 'SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''kyc_document_submissions'' AND column_name = ''document_number'') THEN 1 ELSE 0 END' }
  @{ m = '303_ads_drop_radius_km.sql'; q = 'SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''ad_campaigns'' AND column_name = ''radius_km'') OR to_regclass(''public.ad_campaigns'') IS NULL THEN 1 ELSE 0 END' }
  @{ m = '325_payment_receipt_download_print_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_download_action'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '333_receipt_totals_tax_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_label_subtotal'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '334_receipt_trim_content_parity_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_section_bill_to'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') = ''Invoice to'' THEN 1 ELSE 0 END' }
  @{ m = '335_receipt_tax_invoice_title_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_document_title'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') = ''Tax invoice'' THEN 1 ELSE 0 END' }
  @{ m = '336_receipt_trim_date_invoice_details_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_label_id'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') = ''Transaction'' AND COALESCE((SELECT value->>''receipt_label_billing_period'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') = ''Billing period'' THEN 1 ELSE 0 END' }
  @{ m = '337_wallet_bank_copy_sticky_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''bank_copy_account_label'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') <> '''' AND COALESCE((SELECT value->''banks''->>''copy_account_label'' FROM platform_settings WHERE key = ''admin_console_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '338_admin_banks_copy_name_label.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->''banks''->>''copy_name_label'' FROM platform_settings WHERE key = ''admin_console_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '339_receipt_drop_reference_upload_screenshot.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''receipt_image_label'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') = ''Upload screenshot'' AND NOT ((SELECT value ? ''reference_label'' FROM platform_settings WHERE key = ''wallet_chrome'')) THEN 1 ELSE 0 END' }
  @{ m = '340_manual_receipt_intent_paid_notif_labels.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''payment_receipts'' AND column_name = ''intent_id'') THEN 1 ELSE 0 END' }
  @{ m = '341_cancel_abandoned_awaiting_receipt_intents.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''list_status_cancelled'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') <> '''' OR COALESCE((SELECT value->''payments''->>''txn_status_cancelled'' FROM platform_settings WHERE key = ''admin_console_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '342_heal_phone_kyc_when_otp_off.sql'; q = 'SELECT CASE WHEN to_regclass(''public.users'') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''users'' AND column_name = ''phone_kyc_verified_at'') THEN 1 ELSE 0 END' }
  @{ m = '343_receipt_detail_modal_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->''payments''->>''receipt_detail_title'' FROM platform_settings WHERE key = ''admin_console_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''list_detail_title'' FROM platform_settings WHERE key = ''wallet_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '344_tournament_entry_fee_required_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''entry_fee_required'' FROM platform_settings WHERE key = ''tournament_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '345_tournament_title_description_placeholders.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''title_placeholder'' FROM platform_settings WHERE key = ''tournament_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '346_entity_media_gallery_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''gallery_max_slots'' FROM platform_settings WHERE key = ''tournament_chrome''), '''') = ''9'' AND COALESCE((SELECT value->>''gallery_max_slots'' FROM platform_settings WHERE key = ''ad_runtime_chrome''), '''') = ''9'' THEN 1 ELSE 0 END' }
  @{ m = '347_home_surface_empty_value_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''empty_value'' FROM platform_settings WHERE key = ''home_surface_chrome''), '''') = ''-'' THEN 1 ELSE 0 END' }
  @{ m = '348_tournaments_player_empty_value_chrome.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''empty_value'' FROM platform_settings WHERE key = ''tournaments_player_chrome''), '''') = ''-'' THEN 1 ELSE 0 END' }
  @{ m = '349_prize_pool_display_marketing_on.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM feature_flags WHERE key = ''prize_pool_display_enabled'' AND enabled = TRUE) THEN 1 ELSE 0 END' }
  @{ m = '533_hosted_events_prize_media.sql'; q = 'SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''hosted_events'' AND column_name = ''prize_image_url'') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''hosted_events'' AND column_name = ''gallery'') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = ''public'' AND table_name = ''hosted_events'' AND column_name = ''description'') AND COALESCE((SELECT value->>''detail_description_label'' FROM platform_settings WHERE key = ''events_player_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''description_label'' FROM platform_settings WHERE key = ''events_organizer_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''prize_media_section_title'' FROM platform_settings WHERE key = ''events_organizer_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''thumbnail_label'' FROM platform_settings WHERE key = ''events_organizer_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''gallery_max_slots'' FROM platform_settings WHERE key = ''events_organizer_chrome''), '''') = ''9'' AND COALESCE((SELECT value->>''detail_prize_image_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''detail_gallery_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') <> '''' AND COALESCE((SELECT value->>''gallery_empty'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') <> '''' THEN 1 ELSE 0 END' }
  @{ m = '534_admin_hosted_list_prize_thumb.sql'; q = 'SELECT CASE WHEN COALESCE((SELECT value->>''thumbnail_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') <> '''' AND lower(COALESCE((SELECT value->>''thumbnail_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''')) NOT IN (''event logo'', ''logo'') AND COALESCE((SELECT value->>''thumbnail_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') <> COALESCE((SELECT value->>''detail_logo_label'' FROM platform_settings WHERE key = ''events_admin_chrome''), '''') THEN 1 ELSE 0 END' }
)

function Invoke-Probes([string]$Label, [scriptblock]$Runner) {
  Write-Host "==== $Label ===="
  $missing = [System.Collections.Generic.List[string]]::new()
  $present = 0
  foreach ($p in $probes) {
    $raw = & $Runner $p.q
    $val = ("$raw").Trim()
    if ($val -eq '1') {
      $present++
      Write-Host "OK $($p.m)"
    } else {
      [void]$missing.Add($p.m)
      Write-Host "MISSING $($p.m) got='$val'"
    }
  }
  Write-Host ("${Label}_PRESENT=$present/$($probes.Count)")
  Write-Host ("${Label}_MISSING=$($missing.Count)")
  if ($missing.Count) { Write-Host ("${Label}_MISSING_LIST=" + ($missing -join ',')) }
  return ,@($missing.ToArray())
}

function Run-SqlFile([string]$Target, [string]$Sql) {
  $tmp = Join-Path $env:TEMP ("dama-mig-probe-" + [guid]::NewGuid().ToString('N') + '.sql')
  [System.IO.File]::WriteAllText($tmp, $Sql + "`n")
  try {
    if ($Target -eq 'docker') {
      Get-Content -Raw $tmp | docker exec -i dama_postgres psql -U dama -d dama -t -A 2>&1
    } else {
      docker run --rm -v "${tmp}:/probe.sql:ro" postgres:16-alpine psql "$Target" -t -A -f /probe.sql 2>&1
    }
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

# Docker local DB
$dockerMissing = Invoke-Probes 'DOCKER' {
  param($q)
  Run-SqlFile 'docker' $q
}

# Live DB via .env URL (never print URL)
$raw = Get-Content $envFile | Where-Object { $_ -match '^DAMA_DATABASE_URL=' } | Select-Object -First 1
if (-not $raw) { $raw = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1 }
if (-not $raw) { throw 'DAMA_DATABASE_URL / DATABASE_URL missing from .env' }
$url = $raw -replace '^[^=]+=', ''

$liveMissing = Invoke-Probes 'LIVE' {
  param($q)
  Run-SqlFile $url $q
}

# Summary exit codes for callers
if ($onlyLocal.Count -or $onlyCont.Count) { Write-Host 'RESULT=file_parity_fail'; exit 3 }
if ($dockerMissing.Count) { Write-Host 'RESULT=docker_missing'; exit 2 }
if ($liveMissing.Count) { Write-Host 'RESULT=live_missing'; exit 1 }
Write-Host 'RESULT=all_ok'
exit 0
