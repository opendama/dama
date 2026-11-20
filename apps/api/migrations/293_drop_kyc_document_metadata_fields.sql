-- Simplify document KYC: keep type + legal name + photos only.
-- Drop printed-ID metadata columns and scrub related chrome keys.

ALTER TABLE kyc_document_submissions
  DROP COLUMN IF EXISTS document_number,
  DROP COLUMN IF EXISTS document_issued_on,
  DROP COLUMN IF EXISTS document_expires_on,
  DROP COLUMN IF EXISTS document_country_code;

UPDATE platform_settings
SET value = (COALESCE(value, '{}'::jsonb)
  - 'doc_kyc_number_label'
  - 'doc_kyc_number_placeholder'
  - 'doc_kyc_issued_label'
  - 'doc_kyc_issued_placeholder'
  - 'doc_kyc_expires_label'
  - 'doc_kyc_expires_placeholder'
  - 'doc_kyc_country_label'
  - 'doc_kyc_country_placeholder'
) || jsonb_build_object(
  'doc_kyc_blurb',
  'Upload a government photo ID and a clear selfie. Passport needs front + selfie; national ID and driver license need front, back, and selfie. Required before cashout.'
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb)
    - 'doc_kyc_number_prefix'
    - 'doc_kyc_issued_prefix'
    - 'doc_kyc_expires_prefix'
    - 'doc_kyc_country_prefix'
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'payments';
