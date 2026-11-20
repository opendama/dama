# Wallet top-up E2E: route + checkout handoff contract + client open-receipt parity.
# Requires API on DAMA_E2E_API (default http://127.0.0.1:18080) with DAMA_ALLOW_E2E_AUTH=1.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$apiRoot = if ($env:DAMA_E2E_API) { $env:DAMA_E2E_API.TrimEnd('/') } else { 'http://127.0.0.1:18080' }
$base = "$apiRoot/api/v1"

$script:pass = 0
$script:fail = 0
function Assert-Check {
  param([string]$Name, [bool]$Ok, [string]$Detail)
  if ($Ok) {
    $script:pass++
    Write-Host "PASS $Name - $Detail"
  } else {
    $script:fail++
    Write-Host "FAIL $Name - $Detail"
  }
}

function Invoke-Json {
  param([string]$Method, [string]$Url, $Headers, $Body)
  $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true }
  if ($Headers) { $params.Headers = $Headers }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Compress -Depth 8)
  }
  try {
    $resp = Invoke-WebRequest @params
    $json = $null
    try { $json = $resp.Content | ConvertFrom-Json } catch {}
    return @{ ok = $true; status = [int]$resp.StatusCode; json = $json; raw = $resp.Content }
  } catch {
    $code = 0; $raw = ''; $json = $null
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
      try { $raw = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch {}
      if (-not $raw -and $_.ErrorDetails) { $raw = $_.ErrorDetails.Message }
      try { $json = $raw | ConvertFrom-Json } catch {}
    } else { $raw = $_.Exception.Message }
    return @{ ok = $false; status = $code; json = $json; raw = $raw }
  }
}

Write-Host "=== static client handoff parity ($root) ==="
$walletTsx = Get-Content "$root\apps\web\src\components\wallet\WalletWorkspace.tsx" -Raw
$manualBanksTsx = Get-Content "$root\apps\web\src\components\wallet\ManualBankAccounts.tsx" -Raw
$dialogTsx = Get-Content "$root\apps\web\src\components\ui\dialog.tsx" -Raw
$walletChromeTs = Get-Content "$root\apps\web\src\types\wallet-chrome.ts" -Raw
$checkoutTs = Get-Content "$root\apps\web\src\hooks\mutation\useCheckoutMutation.ts" -Raw
$paymentsTs = Get-Content "$root\apps\web\src\types\payments.ts" -Raw
$adminBanksTsx = Get-Content "$root\apps\admin\src\app\(console)\banks\page.tsx" -Raw
$adminDialogTsx = Get-Content "$root\apps\admin\src\components\ui\dialog.tsx" -Raw
$walletDart = Get-Content "$root\apps\mobile\lib\features\wallet\wallet_page.dart" -Raw
$walletChromeDart = Get-Content "$root\apps\mobile\lib\core\types\wallet_chrome.dart" -Raw
$cubitDart = Get-Content "$root\apps\mobile\lib\features\wallet\wallet_cubit.dart" -Raw
$banksGo = Get-Content "$root\apps\api\internal\store\banks.go" -Raw
$paymentsGo = Get-Content "$root\apps\api\internal\rest\payments_handlers.go" -Raw
$chromeGo = Get-Content "$root\apps\api\internal\rest\chrome_handlers.go" -Raw
$mig337 = Get-Content "$root\apps\api\migrations\337_wallet_bank_copy_sticky_chrome.sql" -Raw
$mig338 = Get-Content "$root\apps\api\migrations\338_admin_banks_copy_name_label.sql" -Raw
$arch = Get-Content "$root\docs\architecture.md" -Raw
$prd = Get-Content "$root\docs\prd-compliance.md" -Raw

Assert-Check 'web_helper' ($paymentsTs -match 'isManualCheckoutResult') 'payments.ts helper'
Assert-Check 'web_open_receipt' (
  $walletTsx -match 'isManualCheckoutResult' -and
  $walletTsx -match 'manual_instructions' -and
  $walletTsx -match 'setTopupStep' -and
  $walletTsx -match 'focusReceiptForm'
) 'WalletWorkspace in-dialog manual_instructions step after checkout'
Assert-Check 'web_sticky_footer' (
  $dialogTsx -match 'isDialogFooterElement' -and
  $dialogTsx -match '\{footers\}' -and
  $dialogTsx -match 'sticky bottom-0' -and
  $dialogTsx -match 'damaDialogFooter' -and
  $dialogTsx -match 'flattenDialogChildren' -and
  $walletTsx -match 'paymentFooterClass' -and
  $walletTsx -match 'damaDialogFooter' -and
  $walletTsx -match 'DialogFooter'
) 'web DialogContent pins DialogFooter; flatten fragments + sticky; wallet branded footer'
Assert-Check 'web_bank_copy' (
  $manualBanksTsx -match 'navigator\.clipboard\.writeText' -and
  $manualBanksTsx -match 'CopyIconButton' -and
  $manualBanksTsx -match 'bank_copy_account_label' -and
  $walletTsx -match 'ManualBankAccounts' -and
  $walletChromeTs -match 'bank_copy_account_label'
) 'web ManualBankAccounts copy icons + chrome keys'
Assert-Check 'web_branded_modal' (
  $walletTsx -match 'dama-gold' -and
  $manualBanksTsx -match 'linear-gradient'
) 'web gold branded receipt modal + bank cards'
Assert-Check 'admin_bank_copy_sticky' (
  $adminBanksTsx -match 'CopyableDetailRow' -and
  $adminBanksTsx -match 'navigator\.clipboard\.writeText' -and
  $adminDialogTsx -match 'isDialogFooterElement' -and
  $adminDialogTsx -match 'sticky bottom-0' -and
  $adminDialogTsx -match 'damaDialogFooter' -and
  $adminBanksTsx -match 'damaDialogFooter' -and
  $adminBanksTsx -match 'dama-gold'
) 'admin banks copy rows + sticky gold DialogFooter'
Assert-Check 'web_assign_url' ($checkoutTs -match 'location\.assign') 'checkout_url same-tab assign'
Assert-Check 'flutter_open_receipt' (
  $walletDart -match '_openReceiptSheet' -and
  $walletDart -match 'awaiting_receipt' -and
  $walletDart -match 'manual_transfer'
) 'Flutter top-up opens receipt sheet for manual'
Assert-Check 'flutter_sticky_copy' (
  $walletDart -match '_bankCopyRow' -and
  $walletDart -match 'Clipboard\.setData' -and
  $walletDart -match 'cancelAction' -and
  $walletChromeDart -match 'bankCopyAccountLabel' -and
  $walletChromeDart -match 'cancelAction' -and
  $walletChromeDart -match 'copyAction\.isNotEmpty' -and
  $walletChromeDart -match 'cancelAction\.isNotEmpty'
) 'Flutter sticky Cancel/Submit + bank Clipboard copy + isReady'
$methodFormPinned = $false
if ($walletTsx -match '(?s)<form[^>]*id="wallet-method-form"[^>]*>(.*?)</form>') {
  $methodFormPinned = ($Matches[1] -notmatch 'DialogFooter') -and ($walletTsx -match 'form="wallet-method-form"')
}
Assert-Check 'web_method_footer_pinned' $methodFormPinned 'method create/edit DialogFooter outside form (pinned)'
Assert-Check 'flutter_cubit_manual' ($cubitDart -match '_isManualCheckout') 'WalletCubit manual detect'
Assert-Check 'api_no_cipher_leak' ($banksGo -match 'looksSealedBankSecret') 'banks.open fail-closed on ciphertext'
Assert-Check 'api_wallet_copy_required' (
  $paymentsGo -match 'bank_copy_account_label' -and
  $paymentsGo -match 'toast_copied' -and
  $paymentsGo -match 'cancel_action'
) 'API WalletChrome requires copy + cancel keys'
Assert-Check 'api_admin_banks_copy_required' (
  $chromeGo -match 'copy_account_label' -and
  $chromeGo -match 'copy_name_label' -and
  $chromeGo -match 'toast_copy_failed'
) 'API admin banks chrome requires copy keys'
Assert-Check 'mig_337_copy_chrome' (
  $mig337 -match 'bank_copy_account_label' -and
  $mig337 -match 'toast_copied' -and
  $mig337 -match 'copy_account_label'
) 'migration 337 wallet + admin banks copy chrome'
Assert-Check 'mig_338_copy_name' ($mig338 -match 'copy_name_label') 'migration 338 admin copy_name_label'
Assert-Check 'doc_arch_topup' (
  $arch -match 'awaiting_receipt' -and
  $arch -match 'checkout_url' -and
  $arch -match 'DAMA_SECRETS_KEY' -and
  $arch -match 'Sticky Cancel' -and
  $arch -match 'Bank copy' -and
  $arch -match '337'
) 'architecture.md top-up + sticky/copy/branding contract'
Assert-Check 'doc_prd_topup' (
  $prd -match 'awaiting_receipt' -and
  $prd -match 'banks/receipt|Submit transfer receipt|manual_instructions' -and
  $prd -match 'DAMA_SECRETS_KEY' -and
  $prd -match 'sticky Cancel/Submit|bank copy' -and
  $prd -match '337'
) 'prd-compliance.md top-up + sticky/copy branding'

Write-Host "=== live API ($base) ==="
$chrome = Invoke-Json -Method GET -Url "$base/public/wallet-chrome"
Assert-Check 'wallet_chrome_ok' ($chrome.ok -and $chrome.status -eq 200) "status=$($chrome.status)"
Assert-Check 'wallet_chrome_copy_keys' (
  $chrome.ok -and
  -not [string]::IsNullOrWhiteSpace([string]$chrome.json.copy_action) -and
  -not [string]::IsNullOrWhiteSpace([string]$chrome.json.toast_copied) -and
  -not [string]::IsNullOrWhiteSpace([string]$chrome.json.bank_copy_account_label) -and
  -not [string]::IsNullOrWhiteSpace([string]$chrome.json.cancel_action)
) "copy/cancel chrome present"
$route = Invoke-Json -Method GET -Url "$base/payments/route"
Assert-Check 'route_ok' ($route.ok -and $route.status -eq 200) "status=$($route.status)"
$provider = [string]$route.json.provider
$cc = [string]$route.json.country_code
Assert-Check 'route_fields' ($provider -ne '' -and $cc -ne '') "provider=$provider country=$cc"

$e2eUser = "e2e_wallet_chk_" + [guid]::NewGuid().ToString('N').Substring(0, 8)
$auth = Invoke-Json -Method POST -Url "$base/auth/e2e/session" -Body @{
  username = $e2eUser
  email    = "$e2eUser@e2e.test"
}
$token = [string]($auth.json.access_token)
if (-not $token) { $token = [string]($auth.json.token) }
Assert-Check 'e2e_auth' ($auth.ok -and $token) "user=$e2eUser status=$($auth.status)"
if (-not $token) {
  Write-Host "SUMMARY pass=$script:pass fail=$script:fail"
  if ($script:fail -gt 0) { exit 1 } else { exit 0 }
}
$h = @{ Authorization = "Bearer $token" }

# Cash RMG gates: age → phone KYC (+ optional OTP) → locate → checkout.
$null = Invoke-Json -Method PUT -Url "$base/me/age-gate" -Headers $h -Body @{ date_of_birth = '1990-01-01' }
$null = Invoke-Json -Method PUT -Url "$base/me/phone-kyc" -Headers $h -Body @{ phone = '+251911223344' }
$otp = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/start" -Headers $h -Body @{}
if ($otp.ok -and $otp.json.debug_code) {
  $null = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/verify" -Headers $h -Body @{
    challenge_id = $otp.json.challenge_id
    code         = $otp.json.debug_code
  }
}
$null = Invoke-Json -Method POST -Url "$base/geo/locate" -Headers $h -Body @{}
$elig = Invoke-Json -Method GET -Url "$base/me/cash-eligibility" -Headers $h
Assert-Check 'cash_eligible' ($elig.ok -and $elig.json.ok -eq $true) "elig=$($elig.json.error_key)"

$checkout = Invoke-Json -Method POST -Url "$base/payments/checkout" -Headers $h -Body @{
  amount       = 25
  purpose      = 'wallet_topup'
  country_code = $cc
}
Assert-Check 'checkout_ok' ($checkout.ok -and $checkout.status -ge 200 -and $checkout.status -lt 300) "status=$($checkout.status) err=$($checkout.json.error_key)"
if (-not ($checkout.ok -and $checkout.status -ge 200 -and $checkout.status -lt 300)) {
  Write-Host "SUMMARY pass=$script:pass fail=$script:fail provider=$provider"
  if ($script:fail -gt 0) { exit 1 }
  exit 0
}
$intent = $checkout.json.intent
$banks = @($checkout.json.banks)
$cProvider = [string]$intent.provider
$cStatus = [string]$intent.status
$cUrl = [string]$intent.checkout_url

if ($provider -eq 'manual_transfer') {
  Assert-Check 'manual_intent' ($cProvider -eq 'manual_transfer' -and $cStatus -eq 'awaiting_receipt') "provider=$cProvider status=$cStatus"
  Assert-Check 'manual_no_url' ([string]::IsNullOrWhiteSpace($cUrl)) "checkout_url empty"
  Assert-Check 'manual_banks' ($banks.Count -gt 0) "banks=$($banks.Count)"
  $leaked = 0
  foreach ($b in $banks) {
    $num = [string]$b.account_number
    $mob = [string]$b.mobile_code
    if ($num -match '^[A-Za-z0-9+/=]{40,}$' -and $num.EndsWith('=')) { $leaked++ }
    if ($mob -match '^[A-Za-z0-9+/=]{40,}$' -and $mob.EndsWith('=')) { $leaked++ }
  }
  Assert-Check 'banks_no_ciphertext' ($leaked -eq 0) "ciphertext_fields=$leaked (re-save banks in admin if empty after key rotate)"
  $plainCount = @($banks | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.account_number) }).Count
  Assert-Check 'banks_readable' ($plainCount -gt 0) "banks_with_account_number=$plainCount (re-save CBE/Awash in admin Payments → Banks)"
} elseif ($provider -eq 'international_checkout' -or $provider -eq 'local_checkout') {
  Assert-Check 'gateway_url' (-not [string]::IsNullOrWhiteSpace($cUrl)) "checkout_url present for $provider"
} else {
  Assert-Check 'known_provider' $false "unexpected provider=$provider"
}

Write-Host "SUMMARY pass=$script:pass fail=$script:fail provider=$provider"
if ($script:fail -gt 0) { exit 1 }
exit 0
