-- Phase C polish: ID document number + expiry chrome (columns intentionally removed in 293).
-- ALTER ADD removed: 069 ADD + 293 DROP every boot left dropped column slots (Postgres 1600 limit).

UPDATE platform_settings
SET value = value || '{
  "doc_kyc_number_label": "ID / passport number",
  "doc_kyc_expires_label": "ID expiry date",
  "doc_kyc_history_pending": "Pending",
  "doc_kyc_history_approved": "Approved",
  "doc_kyc_history_rejected": "Rejected",
  "doc_kyc_history_all": "All"
}'::jsonb,
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND COALESCE(value->>'doc_kyc_number_label', '') = '';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "doc_kyc_number_prefix": "ID number",
    "doc_kyc_expires_prefix": "Expires",
    "doc_kyc_filter_label": "KYC status filter",
    "doc_kyc_history_pending": "Pending",
    "doc_kyc_history_approved": "Approved",
    "doc_kyc_history_rejected": "Rejected",
    "doc_kyc_history_all": "All"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND COALESCE(value->'payments'->>'doc_kyc_number_prefix', '') = '';
