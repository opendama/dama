-- Admin control room: pending label for force-start (parity with forfeit_pending).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'force_start_match_pending', COALESCE(
    NULLIF(trim(value->>'force_start_match_pending'), ''),
    'Starting'
  )
),
    updated_at = NOW()
WHERE key = 'tournament_chrome';
