-- Official pause dedicated rate budget (ops/min). Soft-fill only. Idempotent.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'rate_limit_per_minute', COALESCE(
    NULLIF(trim(value->>'rate_limit_per_minute'), ''),
    '20'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
