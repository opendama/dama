-- Mig 393: Player chrome keys used by writeEventsPlayerErr on check-in / start-game /
-- cannot-view-join paths were never soft-filled onto events_player_chrome (only organizer).
-- Without them players fall back to events_player_chrome_unavailable.
-- Soft-fill empty/missing; force known legacy Event wording. Idempotent.
-- Admin/ops Event language unchanged. Backend tables unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'cannot_join_status',
  COALESCE(NULLIF(trim(value->>'cannot_join_status'), ''), 'This tournament is not open for joining'),
  'err_start_failed',
  COALESCE(NULLIF(trim(value->>'err_start_failed'), ''), 'Unable to start tournament'),
  'err_start_game_failed',
  COALESCE(NULLIF(trim(value->>'err_start_game_failed'), ''), 'Unable to start game')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'cannot_join_status', 'This tournament is not open for joining',
  'err_start_failed', 'Unable to start tournament'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'cannot_join_status', '') ILIKE '%event%'
    OR COALESCE(value->>'err_start_failed', '') ILIKE '%event%'
  );
