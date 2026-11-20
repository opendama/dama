-- 516: Official cup admin players roster Status column chrome (parity with hosted events).
-- Idempotent soft-fill.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'detail_players_col_status',
  COALESCE(
    NULLIF(trim(value->>'detail_players_col_status'), ''),
    'Status'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';
