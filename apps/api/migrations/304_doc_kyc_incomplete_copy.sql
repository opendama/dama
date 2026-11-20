-- Professional incomplete-KYC copy (sentence case; clients highlight fields + toast this string only).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{doc_kyc_incomplete_error}',
  to_jsonb('Complete all required identity fields before submitting.'::text),
  true
),
updated_at = NOW()
WHERE key = 'cash_rmg_chrome'
  AND (
    COALESCE(trim(value->>'doc_kyc_incomplete_error'), '') = ''
    OR trim(value->>'doc_kyc_incomplete_error') = 'complete identity documents before submitting'
  );
