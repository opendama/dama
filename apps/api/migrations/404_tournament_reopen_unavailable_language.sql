-- Mig 404: Hosting reopen_action + chrome unavailable - Tournament wording if Event-sport regresses.
-- Complements 401–403. Idempotent. Backend tables unmerged. Admin Events catalog unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'reopen_action',
  CASE
    WHEN COALESCE(trim(value->>'reopen_action'), '') ~* 'event'
      THEN 'Reopen tournament'
    ELSE COALESCE(NULLIF(trim(value->>'reopen_action'), ''), 'Reopen tournament')
  END,
  'events_organizer_chrome_unavailable',
  CASE
    WHEN COALESCE(trim(value->>'events_organizer_chrome_unavailable'), '') ~* 'event'
      THEN 'Hosting chrome unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'events_organizer_chrome_unavailable'), ''), 'Hosting chrome unavailable')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'reopen_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'events_organizer_chrome_unavailable'), '') ~* 'event'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'events_player_chrome_unavailable',
  CASE
    WHEN COALESCE(trim(value->>'events_player_chrome_unavailable'), '') ~* 'event'
      THEN 'Community tournaments unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'events_player_chrome_unavailable'), ''), 'Community tournaments unavailable')
  END
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND COALESCE(trim(value->>'events_player_chrome_unavailable'), '') ~* 'event';
