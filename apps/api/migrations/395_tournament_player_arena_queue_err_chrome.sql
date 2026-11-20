-- Mig 395: Hosted arena queue/leave errors use writeEventsPlayerErr("toast_arena_queue_failed")
-- but that key was only soft-filled on events_organizer_chrome (mig 366). Players got the
-- generic events_player_chrome_unavailable fallback. Soft-fill player chrome. Idempotent.
-- Also soft-fill toast_arena_start_failed for parity. Backend tables unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_arena_queue_failed',
  COALESCE(NULLIF(trim(value->>'toast_arena_queue_failed'), ''), 'Unable to join arena queue'),
  'toast_arena_start_failed',
  COALESCE(NULLIF(trim(value->>'toast_arena_start_failed'), ''), 'Unable to start arena')
),
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'toast_arena_queue_failed', 'Unable to join arena queue',
  'toast_arena_start_failed', 'Unable to start arena'
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(value->>'toast_arena_queue_failed', '') ILIKE '%event%'
    OR COALESCE(value->>'toast_arena_start_failed', '') ILIKE '%event%'
  );
