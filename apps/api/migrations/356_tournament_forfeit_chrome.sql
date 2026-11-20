-- Admin tournament forfeit / DQ chrome + console match error keys (idempotent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'forfeit_action', COALESCE(NULLIF(trim(value->>'forfeit_action'), ''), 'Forfeit'),
  'forfeit_pending', COALESCE(NULLIF(trim(value->>'forfeit_pending'), ''), 'Forfeiting'),
  'err_forfeit_failed', COALESCE(NULLIF(trim(value->>'err_forfeit_failed'), ''), 'Unable to forfeit match'),
  'err_match_not_found', COALESCE(NULLIF(trim(value->>'err_match_not_found'), ''), 'Match not found'),
  'err_match_not_ready', COALESCE(NULLIF(trim(value->>'err_match_not_ready'), ''), 'Match is not ready')
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_forfeit_failed', COALESCE(NULLIF(trim(value->>'err_forfeit_failed'), ''), 'Unable to forfeit match')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
