-- Mig 383: Player/host fail-closed unavailable chrome - Tournament wording (not Event sport).
-- Admin events_admin_chrome stays ops. Backend tables unchanged. Idempotent.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'detail_unavailable', 'Tournament unavailable',
  'lobby_unavailable', 'Cup lobby unavailable',
  'events_player_chrome_unavailable', 'Community tournaments unavailable'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'detail_unavailable', '') ILIKE '%event%'
    OR COALESCE(value->>'lobby_unavailable', '') ILIKE '%event%'
    OR COALESCE(value->>'events_player_chrome_unavailable', '') ILIKE '%event%'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_catalog_unavailable', 'Tournament catalog unavailable',
  'events_organizer_chrome_unavailable', 'Hosting chrome unavailable'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(value->>'err_catalog_unavailable', '') ILIKE '%event%'
    OR COALESCE(value->>'events_organizer_chrome_unavailable', '') ILIKE '%event%'
  );
