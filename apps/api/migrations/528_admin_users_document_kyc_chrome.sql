-- Admin users detail: document KYC label (fail-closed chrome; no client invent).

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
    'detail_document_kyc_label',
    COALESCE(NULLIF(trim(value->'users'->>'detail_document_kyc_label'), ''), 'Document KYC')
  )
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
