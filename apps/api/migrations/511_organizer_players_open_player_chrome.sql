-- 511: Organizer manage players: Open player label (soft-fill; optional key).
-- Idempotent.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'players_open_player_label',
  COALESCE(NULLIF(trim(value->>'players_open_player_label'), ''), 'Open player')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
