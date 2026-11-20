-- Mig 394: Spectate activity panel - no player-facing “Event” sport label.
-- Soft-fill empty; force known legacy “Event log” / “No events yet”. Idempotent.
-- Tournament discovery UX unchanged. Backend tables unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'event_log_title',
  COALESCE(NULLIF(trim(value->>'event_log_title'), ''), 'Match log'),
  'no_events',
  COALESCE(NULLIF(trim(value->>'no_events'), ''), 'No activity yet')
),
updated_at = NOW()
WHERE key = 'spectate_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'event_log_title', 'Match log',
  'no_events', 'No activity yet'
),
updated_at = NOW()
WHERE key = 'spectate_chrome'
  AND (
    COALESCE(value->>'event_log_title', '') ILIKE '%event%'
    OR COALESCE(value->>'no_events', '') ILIKE '%event%'
  );
