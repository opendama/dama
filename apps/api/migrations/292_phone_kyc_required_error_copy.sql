-- Force worldwide phone KYC gate copy (291 kept the prior English via COALESCE).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'phone_kyc_required_error',
  'Verify your phone number to use cash wallet features'
),
    updated_at = NOW()
WHERE key = 'cash_rmg_chrome';
