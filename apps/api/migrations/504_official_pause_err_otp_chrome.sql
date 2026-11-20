-- Official pause OTP reject chrome (soft-fill, idempotent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_otp', COALESCE(
    NULLIF(trim(value->>'err_otp'), ''),
    'Verify your account before changing match pause state.'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
