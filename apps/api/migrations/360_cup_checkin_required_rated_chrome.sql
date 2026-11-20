-- Cup start requires check-in (server seed); chrome blurbs + default check-in close hours.
-- Platform tournament board games already rate when public_event_matches_rated is on (DB).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'competition_check_in_window_hours', COALESCE(
    NULLIF(trim(value->>'competition_check_in_window_hours'), ''),
    '24'
  )
),
    updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'check_in_required_blurb', COALESCE(
    NULLIF(trim(value->>'check_in_required_blurb'), ''),
    'Check in before the cup starts or you may not get a bracket seat.'
  )
),
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'check_in_required_blurb', COALESCE(
    NULLIF(trim(value->>'check_in_required_blurb'), ''),
    'Check in before the cup starts or you may not get a bracket seat.'
  )
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';

-- Ensure rated flag row exists (do not force-enable if admin already toggled off).
INSERT INTO feature_flags (key, enabled, payload, updated_at)
VALUES ('public_event_matches_rated', TRUE, '{}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
