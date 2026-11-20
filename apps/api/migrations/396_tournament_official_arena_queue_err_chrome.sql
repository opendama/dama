-- Mig 396: Official (platform) arena join/leave used writeTournamentsPlayerErr("err_start_failed")
-- ("Unable to start tournament") - wrong copy for queue failures. Soft-fill Community-parity
-- toast_arena_queue_failed / toast_arena_start_failed onto tournaments_player_chrome.
-- Handlers switch to toast_arena_queue_failed. Idempotent. Backend tables unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_arena_queue_failed',
  COALESCE(NULLIF(trim(value->>'toast_arena_queue_failed'), ''), 'Unable to join arena queue'),
  'toast_arena_start_failed',
  COALESCE(NULLIF(trim(value->>'toast_arena_start_failed'), ''), 'Unable to start arena')
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_arena_queue_failed', 'Unable to join arena queue',
  'toast_arena_start_failed', 'Unable to start arena'
),
updated_at = NOW()
WHERE key = 'tournaments_player_chrome'
  AND (
    COALESCE(value->>'toast_arena_queue_failed', '') ILIKE '%event%'
    OR COALESCE(value->>'toast_arena_start_failed', '') ILIKE '%event%'
  );
