# Trim-parity payment receipt detail + first-party PDF (owner + console).
$ErrorActionPreference = 'Stop'
$base = if ($env:DAMA_E2E_API) { "$($env:DAMA_E2E_API.TrimEnd('/'))/api/v1" } else { 'http://127.0.0.1:18080/api/v1' }

function New-Session([string]$Username, [string]$Email, [string]$Role = '') {
  $body = @{ username = $Username; email = $Email }
  if ($Role) { $body.role = $Role }
  return Invoke-RestMethod -Method Post -Uri "$base/auth/e2e/session" -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

$u = "rcpt_" + [guid]::NewGuid().ToString('N').Substring(0, 10)
$player = New-Session $u "$u@e2e.test"
$pt = $player.access_token; if (-not $pt) { $pt = $player.accessToken }
$h = @{ Authorization = "Bearer $pt" }
$adm = New-Session "adm_$u" "adm_$u@e2e.test" 'admin'
$at = $adm.access_token; if (-not $at) { $at = $adm.accessToken }
$ah = @{ Authorization = "Bearer $at" }

$null = Invoke-RestMethod -Method Post -Uri "$base/feature-flags" -Headers $ah -ContentType 'application/json' -Body (@{ key = 'ethiopian_payment_mode'; enabled = $true; mode = 'manual_transfer' } | ConvertTo-Json)
$null = Invoke-RestMethod -Method Put -Uri "$base/me/age-gate" -Headers $h -ContentType 'application/json' -Body (@{ date_of_birth = '1988-06-01' } | ConvertTo-Json)
$null = Invoke-RestMethod -Method Put -Uri "$base/me/phone-kyc" -Headers $h -ContentType 'application/json' -Body (@{ phone = '+251955667799' } | ConvertTo-Json)
$null = Invoke-RestMethod -Method Post -Uri "$base/geo/locate" -Headers $h -ContentType 'application/json' -Body (@{ lat = 9.03; lng = 38.74 } | ConvertTo-Json)

$rec = Invoke-RestMethod -Method Post -Uri "$base/payments/receipts" -Headers $h -ContentType 'application/json' -Body (@{
    amount       = 5
    currency     = 'ETB'
    country_code = 'ET'
    reference    = "e2e_$u"
    receipt_url  = 'https://cdn.example/smoke.png'
  } | ConvertTo-Json)
$rid = $rec.id
if (-not $rid) { throw 'receipt create failed' }

$detail = Invoke-RestMethod -Uri "$base/payments/receipts/$rid" -Headers $h
if (-not $detail.first_party_pdf_href) { throw 'owner detail missing first_party_pdf_href' }

$pdf = Invoke-WebRequest -Uri "$base/payments/receipts/$rid/pdf" -Headers @{
  Authorization = "Bearer $pt"
  Accept        = 'application/pdf'
  Origin        = 'http://127.0.0.1:3000'
} -UseBasicParsing
$ms = New-Object System.IO.MemoryStream
$pdf.RawContentStream.Position = 0
$pdf.RawContentStream.CopyTo($ms)
$arr = $ms.ToArray()
if ([Text.Encoding]::ASCII.GetString($arr[0..4]) -ne '%PDF-') { throw 'owner PDF magic failed' }
$pdfText = [Text.Encoding]::ASCII.GetString($arr)
foreach ($needle in @(
    'Tax invoice', 'Invoice to', 'Invoice from', 'Invoice details',
    'Invoice reference', 'Currency code', 'Product', 'Unit price', 'Tax rate', 'Tax %',
    'Questions about this receipt',
    'Subtotal', 'VAT', 'Amount paid', 'Total', 'Tax breakdown', 'Tax total', '/Im1'
  )) {
  if ($pdfText -notlike "*$needle*") { throw "owner PDF missing '$needle'" }
}
if ($arr.Length -lt 8000) { throw "owner PDF too small for Trim-parity layout len=$($arr.Length)" }
if ($arr.Length -gt 800000) { throw "owner PDF mark not downsampled len=$($arr.Length)" }
$fn = "$($pdf.Headers['X-Dama-Download-Filename'])"
if (-not $fn) { throw 'owner PDF missing X-Dama-Download-Filename' }
$expose = "$($pdf.Headers['Access-Control-Expose-Headers'])"
if ($expose -notmatch 'X-Dama-Download-Filename') {
  throw "CORS missing X-Dama-Download-Filename expose got='$expose'"
}

$cd = Invoke-RestMethod -Uri "$base/payments/console/receipts/$rid" -Headers $ah
if (-not ("$($cd.first_party_pdf_href)").Contains('console')) { throw 'console href missing console segment' }
$cpdf = Invoke-WebRequest -Uri "$base/payments/console/receipts/$rid/pdf" -Headers @{ Authorization = "Bearer $at"; Accept = 'application/pdf' } -UseBasicParsing
$cms = New-Object System.IO.MemoryStream
$cpdf.RawContentStream.Position = 0
$cpdf.RawContentStream.CopyTo($cms)
$carr = $cms.ToArray()
if ([Text.Encoding]::ASCII.GetString($carr[0..4]) -ne '%PDF-') { throw 'console PDF magic failed' }

$other = New-Session "o_$u" "o_$u@e2e.test"
try {
  Invoke-WebRequest -Uri "$base/payments/receipts/$rid/pdf" -Headers @{ Authorization = "Bearer $($other.access_token)"; Accept = 'application/pdf' } -UseBasicParsing | Out-Null
  throw 'non-owner must not download'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -notin 404, 403) { throw "non-owner expected 404/403 got $code" }
}

$wc = Invoke-RestMethod "$base/public/wallet-chrome"
$ac = Invoke-RestMethod -Uri "$base/public/admin-console-chrome" -Headers $ah
if (-not $wc.receipt_download_action -or -not $ac.payments.receipt_download_action) { throw 'download chrome missing' }
if (-not $wc.receipt_print_action -or -not $ac.payments.receipt_print_action) { throw 'print chrome missing' }
foreach ($needle in @(
    'receipt_document_title', 'receipt_section_bill_to', 'receipt_section_from',
    'receipt_section_details', 'receipt_section_payment', 'receipt_label_reference',
    'receipt_label_currency', 'receipt_col_product', 'receipt_col_unit', 'receipt_col_tax_rate',
    'receipt_label_tax_percent', 'receipt_footer',
    'receipt_label_subtotal', 'receipt_label_tax', 'receipt_label_total', 'receipt_label_amount_paid',
    'receipt_col_qty', 'receipt_section_tax_breakdown', 'receipt_label_tax_total', 'receipt_tax_rate_display'
  )) {
  if (-not "$($wc.$needle)".Trim()) { throw "wallet chrome missing $needle" }
  if (-not "$($ac.payments.$needle)".Trim()) { throw "admin payments chrome missing $needle" }
}
if ("$($wc.receipt_document_title)" -ne 'Tax invoice') { throw "wallet title want Tax invoice got=$($wc.receipt_document_title)" }
if ("$($wc.receipt_section_bill_to)" -ne 'Invoice to') { throw "wallet bill_to want Invoice to got=$($wc.receipt_section_bill_to)" }
if ("$($wc.receipt_footer)" -notlike 'Questions about this receipt*') { throw "wallet footer not Trim-parity" }

try {
  $null = Invoke-RestMethod -Method Post -Uri "$base/feature-flags" -Headers $ah -ContentType 'application/json' -Body (@{ key = 'ethiopian_payment_mode'; enabled = $true; mode = 'local_checkout' } | ConvertTo-Json)
} catch {}

Write-Host "E2E_RECEIPT_PASS id=$rid owner_pdf=$($arr.Length) console_pdf=$($carr.Length)"
