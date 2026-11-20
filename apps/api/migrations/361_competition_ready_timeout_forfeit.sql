-- Ready-check timeout: if one seat is Ready and the opponent is not after N seconds, auto-forfeit the no-show.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'competition_match_ready_timeout_seconds', COALESCE(
    NULLIF(trim(value->>'competition_match_ready_timeout_seconds'), ''),
    '300'
  ),
  'competition_match_ready_auto_forfeit', COALESCE(
    NULLIF(trim(value->>'competition_match_ready_auto_forfeit'), ''),
    'true'
  )
),
    updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'ready_timeout_blurb', COALESCE(
    NULLIF(trim(value->>'ready_timeout_blurb'), ''),
    'If your opponent does not ready in time, they may be forfeited.'
  )
),
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'ready_timeout_blurb', COALESCE(
    NULLIF(trim(value->>'ready_timeout_blurb'), ''),
    'If your opponent does not ready in time, they may be forfeited.'
  )
),
    updated_at = NOW()
WHERE key = 'events_player_chrome';
