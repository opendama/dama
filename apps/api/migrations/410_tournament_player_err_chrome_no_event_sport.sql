-- Mig 410: Force player writeEventsPlayerErr keys off Event sport.
-- Root cause: mig 201 ||-seeded "Event not found" / "You cannot view this event";
-- mig 380 player UPDATE WHERE only matched lobby/search/report/feature_disabled,
-- so once those were Tournament-safe the err_* keys never soft-filled.
-- SoftCommunityJoinStatusMessage still fail-opens at paint. Idempotent.
-- Admin/ops Event language unchanged. Backend tables unmerged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_event_not_found',
  CASE
    WHEN COALESCE(trim(value->>'err_event_not_found'), '') ~* 'event'
      THEN 'Tournament not found'
    ELSE COALESCE(NULLIF(trim(value->>'err_event_not_found'), ''), 'Tournament not found')
  END,
  'err_forbidden',
  CASE
    WHEN COALESCE(trim(value->>'err_forbidden'), '') ~* 'event'
      THEN 'You cannot view this tournament'
    ELSE COALESCE(NULLIF(trim(value->>'err_forbidden'), ''), 'You cannot view this tournament')
  END,
  'public_disabled',
  CASE
    WHEN COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
      THEN 'Community tournaments are temporarily unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'public_disabled'), ''), 'Community tournaments are temporarily unavailable')
  END
),
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND (
    COALESCE(trim(value->>'err_event_not_found'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_forbidden'), '') ~* 'event'
    OR COALESCE(trim(value->>'public_disabled'), '') ~* 'event'
  );
