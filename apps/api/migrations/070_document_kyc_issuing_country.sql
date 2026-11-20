-- Phase C polish: issuing-country chrome (column intentionally removed in 293).
-- ALTER ADD removed: 070 ADD + 293 DROP every boot left dropped column slots (Postgres 1600 limit).

UPDATE platform_settings
SET value = value || '{
  "doc_kyc_country_label": "ID issuing country",
  "doc_kyc_blurb": "Upload a government photo ID and a clear selfie. Enter the ID number, expiry, and issuing country exactly as printed. Passport needs front + selfie; national ID and driver license need front, back, and selfie. Required before cashout."
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_country_label', '') = '';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "doc_kyc_country_prefix": "Issued in",
    "doc_kyc_front_caption": "ID front",
    "doc_kyc_back_caption": "ID back",
    "doc_kyc_selfie_caption": "Selfie"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'payments'->>'doc_kyc_country_prefix', '') = '';
