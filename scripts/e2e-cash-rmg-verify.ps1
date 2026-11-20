# Live verification of cash/RMG Phase B + Phase C document KYC (+ payout ops + docs/native).
# Requires API listening with DAMA_ALLOW_E2E_AUTH=1.
$ErrorActionPreference = 'Continue'
$base = if ($env:DAMA_E2E_API) { "$($env:DAMA_E2E_API.TrimEnd('/'))/api/v1" } else { 'http://127.0.0.1:8080/api/v1' }
$root = 'C:\Users\berek\Downloads\C-Projects\addismender-project\dama'

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

Write-Host '=== docs / native / invent ==='
$prd = Get-Content "$root\docs\prd-compliance.md" -Raw
$arch = Get-Content "$root\docs\architecture.md" -Raw
$html = Get-Content "$root\docs\dama_prd_sad.html" -Raw
$pack = Get-Content "$root\apps\mobile\STORE_PACKAGING.md" -Raw
Assert-Check 'doc_prd' ($prd -match 'Cash RMG' -and $prd -match 'disabled_countries' -and $prd -match 'age_verified_at' -and $prd -match 'document KYC|document_kyc|kyc_document' -and $prd -match '293' -and $prd -notmatch 'number \+ issue date \+ expiry \+ issuing country') 'prd-compliance.md'
Assert-Check 'doc_arch' ($arch -match 'EvaluateCash' -and $arch -match 'cash_rmg_policy' -and $arch -match 'kyc/documents|document KYC|RequireDocumentKyc' -and $arch -match '293' -and $arch -match 'MediaDropzone|document type' -and $arch -notmatch 'document number \+ issue date') 'architecture.md'
Assert-Check 'doc_html' ($html -match 'EvaluateCash' -and $html -match 'disabled_countries' -and $html -match 'document KYC|kyc/documents|document_kyc' -and $html -match '293' -and $html -notmatch 'ID number \+ issue date \+ expiry \+ issuing country') 'dama_prd_sad.html'
Assert-Check 'doc_no_deferral' (
  $prd -notmatch 'intentionally left for later' -and $arch -notmatch 'intentionally left for later' -and
  $html -notmatch 'intentionally left for later' -and $prd -notmatch 'ET-first' -and $arch -notmatch 'ET-first' -and
  $html -notmatch 'ET-first'
) 'no Phase C deferral language'
Assert-Check 'web_doc_kyc' ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'kyc/documents') 'DocumentKycPanel'
Assert-Check 'flutter_doc_kyc' ((Get-Content "$root\apps\mobile\lib\features\compliance\document_kyc_panel.dart" -Raw) -match 'kyc/documents') 'document_kyc_panel'
Assert-Check 'admin_doc_kyc' ((Get-Content "$root\apps\admin\src\app\(console)\payments\page.tsx" -Raw) -match 'AdminDocKycSection') 'admin payments DocKyc'
Assert-Check 'doc_pack' ($pack -match 'PrivacyInfo' -and $pack -match '17\+' -and $pack -match '5\.3') 'STORE_PACKAGING.md'
Assert-Check 'nat_privacy' (Test-Path "$root\apps\mobile\ios\Runner\PrivacyInfo.xcprivacy") 'PrivacyInfo.xcprivacy'
Assert-Check 'nat_plist' (Test-Path "$root\apps\mobile\ios\Runner\Info.plist") 'Info.plist'
Assert-Check 'nat_manifest' (Test-Path "$root\apps\mobile\android\app\src\main\AndroidManifest.xml") 'AndroidManifest.xml'
Assert-Check 'no_invent_web' (-not ((Get-Content "$root\apps\web\src\hooks\query\useCashRmgChromeQuery.ts" -Raw) -match 'cash rmg unavailable')) 'useCashRmgChromeQuery'
Assert-Check 'no_invent_api' (-not ((Get-Content "$root\apps\api\internal\rest\cash_rmg_handlers.go" -Raw) -match '"cash rmg unavailable"')) 'cash_rmg_handlers'
Assert-Check 'flutter_enroll_country' ((Get-Content "$root\apps\mobile\lib\features\tournaments\payment_enroll_dialog.dart" -Raw) -match 'isFree && wallet\.country') 'payment_enroll_dialog'
Assert-Check 'web_enroll_kill' ((Get-Content "$root\apps\web\src\components\tournaments\PaymentEnrollModal.tsx" -Raw) -match 'cash_rmg_enabled' -and (Get-Content "$root\apps\web\src\components\tournaments\PaymentEnrollModal.tsx" -Raw) -match 'cashLocked') 'PaymentEnrollModal kill switch'
Assert-Check 'flutter_enroll_kill' ((Get-Content "$root\apps\mobile\lib\features\tournaments\payment_enroll_dialog.dart" -Raw) -match 'cashAllowedForCountry' -and (Get-Content "$root\apps\mobile\lib\features\tournaments\payment_enroll_dialog.dart" -Raw) -match 'feature-flags') 'payment_enroll_dialog kill switch'
Assert-Check 'flutter_flags_wire' ((Get-Content "$root\apps\mobile\lib\core\types\feature_flags.dart" -Raw) -match 'cashRmgEnabled' -and (Get-Content "$root\apps\mobile\lib\core\types\feature_flags.dart" -Raw) -match 'cashAllowedForCountry') 'FeatureFlagsWire cash fields'
Assert-Check 'web_wallet_kill' ((Get-Content "$root\apps\web\src\app\(player)\wallet\page.tsx" -Raw) -match 'cashLocked' -and (Get-Content "$root\apps\web\src\app\(player)\wallet\page.tsx" -Raw) -match 'cash_rmg_enabled') 'wallet page kill switch'
Assert-Check 'flutter_wallet_kill' ((Get-Content "$root\apps\mobile\lib\features\wallet\wallet_cubit.dart" -Raw) -match 'cashLocked' -and (Get-Content "$root\apps\mobile\lib\features\wallet\wallet_cubit.dart" -Raw) -match 'loadCashGate') 'wallet cubit kill switch'
Assert-Check 'web_locate_bearer' ((Get-Content "$root\apps\web\src\hooks\query\useDetectBrowserCountryQuery.ts" -Raw) -match 'authHeaders' -and (Get-Content "$root\apps\web\src\hooks\query\usePlayerGeoQuery.ts" -Raw) -match 'authHeaders') 'web locate Bearer for geo_ip_records'
Assert-Check 'api_locate_geoip_only' ((Get-Content "$root\apps\api\internal\rest\geo_handlers.go" -Raw) -match 'persist := result.Source == "geoip"' -and (Get-Content "$root\apps\api\internal\rest\geo_handlers.go" -Raw) -match 'DAMA_ALLOW_E2E_AUTH' -and ((Get-Content "$root\apps\api\internal\rest\geo_handlers.go" -Raw) -notmatch 'Source == "gps"')) 'locate bind geoip only'

Write-Host '=== live API gates ==='
$chrome = Invoke-RestMethod "$base/public/cash-rmg-chrome"
Assert-Check 'policy' (
  $chrome.policy.min_age_years -eq 18 -and
  ($chrome.policy.allowed_country_codes -contains 'ET') -and
  $chrome.policy.require_locate_for_cash -eq $true -and
  $chrome.policy.otp_phone_channel -eq 'phone' -and
  [bool]$chrome.policy.default_payout_status -and
  [bool]$chrome.policy.approved_payout_status -and
  [bool]$chrome.policy.rejected_payout_status -and
  [bool]$chrome.policy.paid_payout_status -and
  $chrome.policy.require_document_kyc_for_payout -eq $true -and
  @($chrome.policy.document_kyc_types).Count -ge 1 -and
  [bool]$chrome.policy.document_kyc_approved_status -and
  [bool]$chrome.chrome.doc_kyc_title -and
  [bool]$chrome.chrome.doc_kyc_camera_action -and
  [bool]$chrome.chrome.doc_kyc_gallery_action -and
  [bool]$chrome.chrome.doc_kyc_blurb -and
  -not [bool]$chrome.chrome.doc_kyc_number_label -and
  -not [bool]$chrome.chrome.doc_kyc_issued_label
) ("age=$($chrome.policy.min_age_years) otp=$($chrome.policy.otp_phone_channel) doc_kyc=$($chrome.policy.require_document_kyc_for_payout)")
Assert-Check 'web_dropzone' ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'MediaDropzone') 'web DocumentKycPanel MediaDropzone'
Assert-Check 'ios_kyc_plist' ((Get-Content "$root\apps\mobile\ios\Runner\Info.plist" -Raw) -match 'identity documents') 'Info.plist identity KYC'
Assert-Check 'ios_privacy_photos' ((Get-Content "$root\apps\mobile\ios\Runner\PrivacyInfo.xcprivacy" -Raw) -match 'PhotosorVideos') 'PrivacyInfo photos'

$terms = Invoke-RestMethod "$base/public/legal/terms"
$priv = Invoke-RestMethod "$base/public/legal/privacy"
$ref = Invoke-RestMethod "$base/public/legal/refunds"
$all = @($terms.sections) + @($priv.sections) + @($ref.sections)
Assert-Check 'legal_18' ((@($all | Where-Object { $_.heading -match 'Age' })).Count -ge 2) 'cash age sections'
Assert-Check 'legal_13' ((($all | ForEach-Object { $_.body }) -join ' ') -match '13') 'under-13 retained'

$u = "crmg_$(Get-Random -Maximum 999999)"
$sess = Invoke-RestMethod -Method Post -Uri "$base/auth/e2e/session" -ContentType 'application/json' -Body (@{ username = $u; email = "$u@e2e.test" } | ConvertTo-Json)
$token = $sess.access_token
$uid = $sess.user.id
$h = @{ Authorization = "Bearer $token" }
$tid = (Invoke-RestMethod "$base/tournaments?skip=0&limit=50").tournaments | Where-Object { -not $_.is_free } | Select-Object -First 1 -ExpandProperty id

$r = Invoke-Json -Method POST -Url "$base/tournaments/$tid/enroll" -Headers $h -Body @{ country_code = 'ET' }
Assert-Check 'gate_enroll_age' ($r.json.error_key -eq 'age_required') "$($r.json.error_key)"
$r = Invoke-Json -Method POST -Url "$base/payments/checkout" -Headers $h -Body @{ amount = 5; purpose = 'wallet_topup'; country_code = 'ET' }
Assert-Check 'gate_checkout_age' ($r.json.error_key -eq 'age_required') "$($r.json.error_key)"
$r = Invoke-Json -Method POST -Url "$base/payments/receipts" -Headers $h -Body @{ amount = 5; currency = 'ETB'; reference = 'x'; receipt_url = 'https://e.com/r.png'; country_code = 'ET' }
Assert-Check 'gate_receipt_age' ($r.json.error_key -eq 'age_required') "$($r.json.error_key)"
$r = Invoke-Json -Method POST -Url "$base/payouts/request" -Headers $h -Body @{ amount = 1; currency = 'ETB'; country_code = 'ET' }
Assert-Check 'gate_payout_age' ($r.json.error_key -eq 'age_required') "$($r.json.error_key)"

$el = Invoke-RestMethod "$base/me/cash-eligibility?country_code=US" -Headers $h
Assert-Check 'gate_us' ($el.error_key -eq 'jurisdiction') "$($el.error_key)"

$r = Invoke-Json -Method PUT -Url "$base/me/age-gate" -Headers $h -Body @{ date_of_birth = '2012-01-01' }
Assert-Check 'age_young' ($r.status -eq 403) "status=$($r.status)"
$r = Invoke-Json -Method PUT -Url "$base/me/age-gate" -Headers $h -Body @{ date_of_birth = '1988-06-01' }
Assert-Check 'age_ok' ([bool]$r.ok) 'adult'

$el = Invoke-RestMethod "$base/me/cash-eligibility?country_code=ET" -Headers $h
Assert-Check 'need_phone' ($el.error_key -eq 'phone_kyc') "$($el.error_key)"
$null = Invoke-Json -Method PUT -Url "$base/me/phone-kyc" -Headers $h -Body @{ phone = '+251955667788' }
$otp = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/start" -Headers $h -Body @{}
Assert-Check 'otp_channel' ($otp.json.channel -eq 'phone' -and [bool]$otp.json.debug_code) "$($otp.json.channel)"
$r = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/verify" -Headers $h -Body @{ challenge_id = $otp.json.challenge_id; code = $otp.json.debug_code }
Assert-Check 'otp_verify' ($r.json.status -eq 'verified') "$($r.json.status)"

$el = Invoke-RestMethod "$base/me/cash-eligibility" -Headers $h
Assert-Check 'need_locate' ($el.error_key -eq 'locate_required') "$($el.error_key)"
$null = Invoke-Json -Method POST -Url "$base/geo/locate" -Headers $h -Body @{}
$el = Invoke-RestMethod "$base/me/cash-eligibility" -Headers $h
Assert-Check 'eligible' ($el.ok -eq $true) "ok=$($el.ok)"

$adm = Invoke-RestMethod -Method Post -Uri "$base/auth/e2e/session" -ContentType 'application/json' -Body (@{ username = "adm_$u"; email = "adm_$u@e2e.test"; role = 'superadmin' } | ConvertTo-Json)
$ah = @{ Authorization = "Bearer $($adm.access_token)"; 'Content-Type' = 'application/json' }
$resp = Invoke-WebRequest "$base/feature-flags" -Method POST -Headers $ah -Body '{"key":"cash_rmg_enabled","enabled":true,"disabled_countries":["ET"]}' -UseBasicParsing
$fl = $resp.Content | ConvertFrom-Json
Assert-Check 'kill_persist' (@($fl.cash_rmg_disabled_countries) -contains 'ET') (($fl.cash_rmg_disabled_countries) -join ',')
$el = Invoke-RestMethod "$base/me/cash-eligibility" -Headers $h
Assert-Check 'kill_country' ($el.error_key -eq 'jurisdiction') "$($el.error_key)"
$null = Invoke-WebRequest "$base/feature-flags" -Method POST -Headers $ah -Body '{"key":"cash_rmg_enabled","enabled":false,"disabled_countries":[]}' -UseBasicParsing
$el = Invoke-RestMethod "$base/me/cash-eligibility" -Headers $h
Assert-Check 'kill_global' ($el.error_key -eq 'cash_disabled') "$($el.error_key)"
$null = Invoke-WebRequest "$base/feature-flags" -Method POST -Headers $ah -Body '{"key":"cash_rmg_enabled","enabled":true,"disabled_countries":[]}' -UseBasicParsing
$null = Invoke-WebRequest "$base/feature-flags" -Method POST -Headers $ah -Body '{"key":"cash_phone_kyc_required","enabled":true}' -UseBasicParsing

# Credit wallet via SQL (no temp go helper required).
docker exec dama_postgres psql -U dama -d dama -v ON_ERROR_STOP=1 -c @"
INSERT INTO wallets (user_id, currency, balance, updated_at)
VALUES ('$uid', 'ETB', 100, NOW())
ON CONFLICT (user_id, currency) DO UPDATE SET balance = wallets.balance + 100, updated_at = NOW();
"@ | Out-Null

$null = Invoke-Json -Method PUT -Url "$base/payouts/method" -Headers $h -Body @{ provider = 'telebirr'; account_name = 'E2E'; phone = '+251955667788' }
$null = Invoke-Json -Method PUT -Url "$base/me/phone-kyc" -Headers $h -Body @{ phone = '+251955667788' }
$otp = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/start" -Headers $h -Body @{}
$null = Invoke-Json -Method POST -Url "$base/me/phone-kyc/otp/verify" -Headers $h -Body @{ challenge_id = $otp.json.challenge_id; code = $otp.json.debug_code }
$null = Invoke-Json -Method POST -Url "$base/geo/locate" -Headers $h -Body @{}

$pol = $chrome.policy
$authJson = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

# Phase C: payout blocked until government-ID document KYC approved
$blocked = Invoke-Json -Method POST -Url "$base/payouts/request" -Headers $h -Body @{ amount = 5; currency = 'ETB'; country_code = 'ET' }
Assert-Check 'gate_payout_doc_kyc' ($blocked.json.error_key -eq 'document_kyc_required') "$($blocked.json.error_key)"
$passport = $pol.document_kyc_passport_type
if (-not $passport) { $passport = 'passport' }

# Real image upload (1x1 PNG) - fabricated URLs must be rejected
$pngPath = Join-Path $env:TEMP 'dama-e2e-kyc.png'
[IO.File]::WriteAllBytes($pngPath, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
function Upload-KycPng {
  param([string]$Bearer)
  $boundary = [guid]::NewGuid().ToString()
  $fileBytes = [IO.File]::ReadAllBytes($pngPath)
  $header = "--$boundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"kyc.png`"`r`nContent-Type: image/png`r`n`r`n"
  $footer = "`r`n--$boundary--`r`n"
  $enc = [Text.Encoding]::UTF8
  $body = New-Object byte[] ($enc.GetByteCount($header) + $fileBytes.Length + $enc.GetByteCount($footer))
  [Buffer]::BlockCopy($enc.GetBytes($header), 0, $body, 0, $enc.GetByteCount($header))
  [Buffer]::BlockCopy($fileBytes, 0, $body, $enc.GetByteCount($header), $fileBytes.Length)
  [Buffer]::BlockCopy($enc.GetBytes($footer), 0, $body, $enc.GetByteCount($header) + $fileBytes.Length, $enc.GetByteCount($footer))
  $resp = Invoke-WebRequest -Uri "$base/kyc/documents/upload" -Method POST -Headers @{ Authorization = "Bearer $Bearer" } -ContentType "multipart/form-data; boundary=$boundary" -Body $body -UseBasicParsing
  return ($resp.Content | ConvertFrom-Json).url
}
$frontUrl = Upload-KycPng -Bearer $token
$selfieUrl = Upload-KycPng -Bearer $token
Assert-Check 'doc_kyc_upload' ([bool]$frontUrl -and [bool]$selfieUrl -and ($frontUrl -match 'dama/kyc|/api/v1/media/')) "front=$frontUrl"

# Non-image upload must fail magic-byte sniff
$txtPath = Join-Path $env:TEMP 'dama-e2e-kyc.txt'
[IO.File]::WriteAllText($txtPath, 'not-an-image')
try {
  $badBoundary = [guid]::NewGuid().ToString()
  $badBytes = [IO.File]::ReadAllBytes($txtPath)
  $badHeader = "--$badBoundary`r`nContent-Disposition: form-data; name=`"file`"; filename=`"kyc.txt`"`r`nContent-Type: text/plain`r`n`r`n"
  $badFooter = "`r`n--$badBoundary--`r`n"
  $enc = [Text.Encoding]::UTF8
  $badBody = New-Object byte[] ($enc.GetByteCount($badHeader) + $badBytes.Length + $enc.GetByteCount($badFooter))
  [Buffer]::BlockCopy($enc.GetBytes($badHeader), 0, $badBody, 0, $enc.GetByteCount($badHeader))
  [Buffer]::BlockCopy($badBytes, 0, $badBody, $enc.GetByteCount($badHeader), $badBytes.Length)
  [Buffer]::BlockCopy($enc.GetBytes($badFooter), 0, $badBody, $enc.GetByteCount($badHeader) + $badBytes.Length, $enc.GetByteCount($badFooter))
  $null = Invoke-WebRequest -Uri "$base/kyc/documents/upload" -Method POST -Headers @{ Authorization = "Bearer $token" } -ContentType "multipart/form-data; boundary=$badBoundary" -Body $badBody -UseBasicParsing
  Assert-Check 'doc_kyc_reject_non_image' $false 'upload accepted non-image'
} catch {
  $code = 0
  if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  Assert-Check 'doc_kyc_reject_non_image' ($code -ge 400) "status=$code"
}

$fakeDraft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = 'E2E Player'
  id_front_url = 'https://e2e.test/kyc/front.jpg'
  id_back_url = ''
  selfie_url = 'https://e2e.test/kyc/selfie.jpg'
}
Assert-Check 'doc_kyc_reject_fake_url' ($fakeDraft.status -ge 400) "status=$($fakeDraft.status)"
$avatarDraft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = 'E2E Player'
  id_front_url = '/api/v1/media/avatars/e2e/1_full.png'
  id_back_url = ''
  selfie_url = $selfieUrl
}
Assert-Check 'doc_kyc_reject_avatar_url' ($avatarDraft.status -ge 400) "status=$($avatarDraft.status)"

# national_id requires back; incomplete submit must fail
$nid = 'national_id'
if (@($pol.document_kyc_types) -contains $nid) {
  $backUrl = Upload-KycPng -Bearer $token
  $nidDraft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
    document_type = $nid
    legal_name = 'E2E National ID'
    id_front_url = $frontUrl
    id_back_url = ''
    selfie_url = $selfieUrl
  }
  Assert-Check 'doc_kyc_nid_draft_no_back' ([bool]$nidDraft.json.submission.id) "$($nidDraft.json.submission.status)"
  $nidBad = Invoke-Json -Method POST -Url "$base/kyc/documents/submit" -Headers $authJson -Body @{ id = [string]$nidDraft.json.submission.id }
  Assert-Check 'doc_kyc_nid_require_back' ($nidBad.status -ge 400) "status=$($nidBad.status)"
  $nidOk = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
    document_type = $nid
    legal_name = 'E2E National ID'
    id_front_url = $frontUrl
    id_back_url = $backUrl
    selfie_url = $selfieUrl
  }
  Assert-Check 'doc_kyc_nid_draft_with_back' ([bool]$nidOk.json.submission.id -and [bool]$nidOk.json.submission.id_back_url) 'back set'
}

# drivers_license also requires back
$dl = 'drivers_license'
if (@($pol.document_kyc_types) -contains $dl) {
  $dlBack = Upload-KycPng -Bearer $token
  $dlDraft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
    document_type = $dl
    legal_name = 'E2E Driver'
    id_front_url = $frontUrl
    id_back_url = $dlBack
    selfie_url = $selfieUrl
  }
  Assert-Check 'doc_kyc_dl_draft' ([bool]$dlDraft.json.submission.id -and $dlDraft.json.submission.document_type -eq $dl) "$($dlDraft.json.submission.document_type)"
}

# legal name + photos required on submit
$noName = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = ''
  id_front_url = $frontUrl
  id_back_url = ''
  selfie_url = $selfieUrl
}
Assert-Check 'doc_kyc_require_name' ($noName.status -ge 400) "status=$($noName.status)"
$noSelfie = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = 'E2E Player'
  id_front_url = $frontUrl
  id_back_url = ''
  selfie_url = ''
}
$noSelfieSub = Invoke-Json -Method POST -Url "$base/kyc/documents/submit" -Headers $authJson -Body @{ id = [string]$noSelfie.json.submission.id }
Assert-Check 'doc_kyc_require_selfie' ($noSelfieSub.status -ge 400) "status=$($noSelfieSub.status)"

$draft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = 'E2E Player'
  id_front_url = $frontUrl
  id_back_url = ''
  selfie_url = $selfieUrl
}
Assert-Check 'doc_kyc_draft' ([bool]$draft.json.submission.id) "$($draft.json.submission.status)"
Assert-Check 'doc_kyc_draft_name' ($draft.json.submission.legal_name -eq 'E2E Player') "$($draft.json.submission.legal_name)"
Assert-Check 'doc_kyc_draft_no_metadata' (
  -not ($draft.json.submission.PSObject.Properties.Name -contains 'document_number') -and
  -not ($draft.json.submission.PSObject.Properties.Name -contains 'document_issued_on')
) 'metadata columns removed'
$subId = [string]$draft.json.submission.id
$submitted = Invoke-Json -Method POST -Url "$base/kyc/documents/submit" -Headers $authJson -Body @{ id = $subId }
Assert-Check 'doc_kyc_submit' ($submitted.json.submission.status -eq $pol.document_kyc_pending_status) "$($submitted.json.submission.status)"
$subId = [string]$submitted.json.submission.id
$pendingRaw = (Invoke-WebRequest "$base/kyc/documents/console?status=pending&skip=0&limit=50" -Headers @{ Authorization = "Bearer $($adm.access_token)" } -UseBasicParsing).Content
$pendingHit = $pendingRaw -match [regex]::Escape($subId)
Assert-Check 'doc_kyc_console_list' $pendingHit "id=$subId raw_has=$pendingHit"
$histRaw = (Invoke-WebRequest "$base/kyc/documents/console?status=all&skip=0&limit=50" -Headers @{ Authorization = "Bearer $($adm.access_token)" } -UseBasicParsing).Content
Assert-Check 'doc_kyc_console_history_all' ($histRaw -match [regex]::Escape($subId)) "id=$subId"
$accPay = (Invoke-RestMethod "$base/public/admin-console-chrome").payments
Assert-Check 'admin_doc_kyc_history_chrome' (
  -not [bool]$accPay.doc_kyc_number_prefix -and
  [bool]$accPay.doc_kyc_front_caption -and [bool]$accPay.doc_kyc_back_caption -and
  [bool]$accPay.doc_kyc_selfie_caption -and [bool]$accPay.doc_kyc_filter_label -and
  [bool]$accPay.doc_kyc_history_all
) "filter=$($accPay.doc_kyc_filter_label)"
Assert-Check 'web_submit_persists' ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'persistDraft') 'web submit saves draft first'
Assert-Check 'web_doc_kyc_field_errors' (
  ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'showErrors') -and
  ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'toastChrome|extractApiErrorMessage') -and
  ((Get-Content "$root\apps\web\src\components\compliance\DocumentKycPanel.tsx" -Raw) -match 'invalid=\{showErrors && field\.missing\}')
) 'DocumentKycPanel sticky field errors + chrome toasts'
Assert-Check 'doc_kyc_incomplete_copy' (
  ([string]$chrome.chrome.doc_kyc_incomplete_error).Trim().Length -gt 0 -and
  ([string]$chrome.chrome.doc_kyc_incomplete_error) -ne 'complete identity documents before submitting'
) "$($chrome.chrome.doc_kyc_incomplete_error)"
Assert-Check 'doc_kyc_submit_incomplete_msg' (
  $noSelfieSub.status -ge 400 -and
  ([string]$noSelfieSub.json.error) -eq ([string]$chrome.chrome.doc_kyc_incomplete_error)
) "err=$($noSelfieSub.json.error)"
Assert-Check 'flutter_doc_kyc_field_errors' (
  ((Get-Content "$root\apps\mobile\lib\features\compliance\document_kyc_panel.dart" -Raw) -match '_showErrors') -and
  ((Get-Content "$root\apps\mobile\lib\features\compliance\document_kyc_panel.dart" -Raw) -match 'invalid:')
) 'flutter sticky field errors'
Assert-Check 'flutter_submit_persists' ((Get-Content "$root\apps\mobile\lib\features\compliance\document_kyc_panel.dart" -Raw) -match '_persistDraft') 'flutter submit saves draft first'

# Reject → resubmit → approve (professional review loop)
$rejected = Invoke-RestMethod -Method Post -Uri "$base/kyc/documents/console/$subId/review" -Headers $ah -Body (@{ status = $pol.document_kyc_rejected_status; note = 'blurry' } | ConvertTo-Json)
Assert-Check 'doc_kyc_reject' ($rejected.status -eq $pol.document_kyc_rejected_status) "$($rejected.status)"
$frontUrl2 = Upload-KycPng -Bearer $token
$selfieUrl2 = Upload-KycPng -Bearer $token
$redraft = Invoke-Json -Method PUT -Url "$base/kyc/documents/draft" -Headers $authJson -Body @{
  document_type = $passport
  legal_name = 'E2E Player Resubmit'
  id_front_url = $frontUrl2
  id_back_url = ''
  selfie_url = $selfieUrl2
}
Assert-Check 'doc_kyc_resubmit_draft' ($redraft.json.submission.status -eq $pol.document_kyc_draft_status) "$($redraft.json.submission.status)"
$subId = [string]$redraft.json.submission.id
$resubmitted = Invoke-Json -Method POST -Url "$base/kyc/documents/submit" -Headers $authJson -Body @{ id = $subId }
Assert-Check 'doc_kyc_resubmit' ($resubmitted.json.submission.status -eq $pol.document_kyc_pending_status) "$($resubmitted.json.submission.status)"
$subId = [string]$resubmitted.json.submission.id

$approved = Invoke-RestMethod -Method Post -Uri "$base/kyc/documents/console/$subId/review" -Headers $ah -Body (@{ status = $pol.document_kyc_approved_status; note = 'e2e ok' } | ConvertTo-Json)
Assert-Check 'doc_kyc_approve' ($approved.status -eq $pol.document_kyc_approved_status) "$($approved.status)"
$meKyc = Invoke-RestMethod "$base/kyc/documents/me" -Headers @{ Authorization = "Bearer $token" }
Assert-Check 'doc_kyc_me_approved' ($meKyc.approved -eq $true) "approved=$($meKyc.approved)"
Assert-Check 'doc_kyc_me_fields' (
  $meKyc.submission.legal_name -eq 'E2E Player Resubmit' -and
  [bool]$meKyc.submission.id_front_url -and [bool]$meKyc.submission.selfie_url
) "name=$($meKyc.submission.legal_name)"

$req = Invoke-RestMethod -Method Post -Uri "$base/payouts/request" -Headers $authJson -Body (@{ amount = 5; currency = 'ETB'; country_code = 'ET' } | ConvertTo-Json)
Assert-Check 'payout_create' ($req.status -eq $pol.default_payout_status) "$($req.status)"
$ap = Invoke-RestMethod -Method Post -Uri "$base/payouts/console/$($req.id)/review" -Headers $ah -Body (@{ status = $pol.approved_payout_status; note = 'ok' } | ConvertTo-Json)
Assert-Check 'payout_approve' ($ap.status -eq $pol.approved_payout_status) "$($ap.status)"
$pd = Invoke-RestMethod -Method Post -Uri "$base/payouts/console/$($req.id)/review" -Headers $ah -Body (@{ status = $pol.paid_payout_status; note = 'paid' } | ConvertTo-Json)
Assert-Check 'payout_paid' ($pd.status -eq $pol.paid_payout_status) "$($pd.status)"
$req2 = Invoke-RestMethod -Method Post -Uri "$base/payouts/request" -Headers $authJson -Body (@{ amount = 2; currency = 'ETB'; country_code = 'ET' } | ConvertTo-Json)
$bb = [double](Invoke-RestMethod "$base/payments/wallet?country_code=ET" -Headers @{ Authorization = "Bearer $token" }).balance
$rj = Invoke-RestMethod -Method Post -Uri "$base/payouts/console/$($req2.id)/review" -Headers $ah -Body (@{ status = $pol.rejected_payout_status; note = 'no' } | ConvertTo-Json)
$ba = [double](Invoke-RestMethod "$base/payments/wallet?country_code=ET" -Headers @{ Authorization = "Bearer $token" }).balance
Assert-Check 'payout_reject_refund' ($rj.status -eq $pol.rejected_payout_status -and $ba -ge ($bb + 1.9)) "st=$($rj.status) $bb->$ba"

$acc = (Invoke-RestMethod "$base/public/admin-console-chrome").feature_flags
Assert-Check 'admin_kill_chrome' (
  [bool]$acc.cash_disabled_countries_title -and [bool]$acc.cash_disabled_countries_save -and [bool]$acc.cash_disabled_countries_failed
) "$($acc.cash_disabled_countries_title)"
Assert-Check 'admin_allow_chrome' (
  [bool]$acc.cash_allowed_countries_title -and [bool]$acc.cash_allowed_countries_add_action -and [bool]$acc.cash_allowed_countries_empty
) "$($acc.cash_allowed_countries_title)"

# Allowlist CRUD (admin): add KE, confirm eligibility gate for KE vs US, remove KE, restore ET-only
$pol0 = Invoke-RestMethod "$base/console/cash-rmg/policy" -Headers $ah
Assert-Check 'allow_get' (@($pol0.allowed_country_codes) -contains 'ET') (($pol0.allowed_country_codes) -join ',')
$null = Invoke-RestMethod -Method Post -Uri "$base/console/cash-rmg/allowed-countries" -Headers $ah -Body (@{ country_code = 'KE' } | ConvertTo-Json)
$pol1 = Invoke-RestMethod "$base/console/cash-rmg/policy" -Headers $ah
Assert-Check 'allow_add_ke' (@($pol1.allowed_country_codes) -contains 'KE') (($pol1.allowed_country_codes) -join ',')
$null = Invoke-RestMethod -Method Delete -Uri "$base/console/cash-rmg/allowed-countries/KE" -Headers $ah
$pol2 = Invoke-RestMethod "$base/console/cash-rmg/policy" -Headers $ah
Assert-Check 'allow_del_ke' (-not (@($pol2.allowed_country_codes) -contains 'KE') -and (@($pol2.allowed_country_codes) -contains 'ET')) (($pol2.allowed_country_codes) -join ',')
$null = Invoke-RestMethod -Method Put -Uri "$base/console/cash-rmg/allowed-countries" -Headers $ah -Body (@{ country_codes = @('ET') } | ConvertTo-Json)
$delEmpty = Invoke-Json -Method DELETE -Url "$base/console/cash-rmg/allowed-countries/ET" -Headers $ah -Body $null
Assert-Check 'allow_refuse_empty' ($delEmpty.status -ge 400) "status=$($delEmpty.status)"

Write-Host ""
Write-Host "RESULT pass=$($script:pass) fail=$($script:fail) total=$($script:pass + $script:fail)"
if ($script:fail -gt 0) { exit 1 }
exit 0
