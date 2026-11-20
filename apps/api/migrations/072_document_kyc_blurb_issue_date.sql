-- Phase C polish: player blurb must mention issue date (world-standard KYC fields).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{doc_kyc_blurb}',
  '"Upload a government photo ID and a clear selfie. Enter the ID number, issue date, expiry, and issuing country exactly as printed. Passport needs front + selfie; national ID and driver license need front, back, and selfie. Required before cashout."'::jsonb
),
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_blurb', '') NOT ILIKE '%issue date%';
