-- Phase C polish: ID issue-date chrome (column intentionally removed in 293).
-- ALTER ADD removed: 071 ADD + 293 DROP every boot left dropped column slots (Postgres 1600 limit).

UPDATE platform_settings
SET value = value || '{
  "doc_kyc_issued_label": "ID issue date"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_issued_label', '') = '';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "doc_kyc_issued_prefix": "Issued on",
    "doc_kyc_empty": "No identity submissions for this filter"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'payments'->>'doc_kyc_issued_prefix', '') = '';
