-- Ensure cash_rmg date placeholders exist (flat cash_rmg_chrome JSON).
-- API Go struct serializes these; web/Flutter treat *_placeholder as optional (not fail-closed).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'age_gate_dob_placeholder',
  COALESCE(
    NULLIF(trim(value->>'age_gate_dob_placeholder'), ''),
    'mm/dd/yyyy'
  ),
  'doc_kyc_issued_placeholder',
  COALESCE(
    NULLIF(trim(value->>'doc_kyc_issued_placeholder'), ''),
    'mm/dd/yyyy'
  ),
  'doc_kyc_expires_placeholder',
  COALESCE(
    NULLIF(trim(value->>'doc_kyc_expires_placeholder'), ''),
    'mm/dd/yyyy'
  )
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';
