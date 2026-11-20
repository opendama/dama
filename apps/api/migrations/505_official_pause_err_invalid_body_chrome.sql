-- Official pause bulk/body parse reject chrome (soft-fill, idempotent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_invalid_body', COALESCE(
    NULLIF(trim(value->>'err_invalid_body'), ''),
    'Could not read that request. Check the form and try again.'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
