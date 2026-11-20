-- Mig 411: Force Hosting organizer writeEventsOrgErr keys off Event sport.
-- Complements 201 organizer seed hardening + 380 host surface soft-fills.
-- SoftHostingToast* still fail-opens at paint. Idempotent.
-- Admin ops events_admin_chrome may keep Event. Backend tables unmerged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_catalog_unavailable',
  CASE
    WHEN COALESCE(trim(value->>'err_catalog_unavailable'), '') ~* 'event'
      THEN 'Tournament catalog unavailable'
    ELSE COALESCE(NULLIF(trim(value->>'err_catalog_unavailable'), ''), 'Tournament catalog unavailable')
  END,
  'err_event_not_found',
  CASE
    WHEN COALESCE(trim(value->>'err_event_not_found'), '') ~* 'event'
      THEN 'Tournament not found'
    ELSE COALESCE(NULLIF(trim(value->>'err_event_not_found'), ''), 'Tournament not found')
  END,
  'err_event_not_editable',
  CASE
    WHEN COALESCE(trim(value->>'err_event_not_editable'), '') ~* 'event'
      THEN 'This tournament cannot be edited'
    ELSE COALESCE(NULLIF(trim(value->>'err_event_not_editable'), ''), 'This tournament cannot be edited')
  END,
  'err_cannot_close',
  CASE
    WHEN COALESCE(trim(value->>'err_cannot_close'), '') ~* 'event'
      THEN 'This tournament cannot be closed'
    ELSE COALESCE(NULLIF(trim(value->>'err_cannot_close'), ''), 'This tournament cannot be closed')
  END,
  'err_cannot_start',
  CASE
    WHEN COALESCE(trim(value->>'err_cannot_start'), '') ~* 'event'
      THEN 'This tournament cannot be started'
    ELSE COALESCE(NULLIF(trim(value->>'err_cannot_start'), ''), 'This tournament cannot be started')
  END,
  'err_event_not_live',
  CASE
    WHEN COALESCE(trim(value->>'err_event_not_live'), '') ~* 'event'
      THEN 'Tournament is not live'
    ELSE COALESCE(NULLIF(trim(value->>'err_event_not_live'), ''), 'Tournament is not live')
  END,
  'err_create_failed',
  CASE
    WHEN COALESCE(trim(value->>'err_create_failed'), '') ~* 'event'
      THEN 'Unable to create tournament'
    ELSE COALESCE(NULLIF(trim(value->>'err_create_failed'), ''), 'Unable to create tournament')
  END,
  'err_update_failed',
  CASE
    WHEN COALESCE(trim(value->>'err_update_failed'), '') ~* 'event'
      THEN 'Unable to update tournament'
    ELSE COALESCE(NULLIF(trim(value->>'err_update_failed'), ''), 'Unable to update tournament')
  END,
  'err_list_failed',
  CASE
    WHEN COALESCE(trim(value->>'err_list_failed'), '') ~* 'event'
      THEN 'Unable to load tournaments'
    ELSE COALESCE(NULLIF(trim(value->>'err_list_failed'), ''), 'Unable to load tournaments')
  END,
  'err_close_failed',
  CASE
    WHEN COALESCE(trim(value->>'err_close_failed'), '') ~* 'event'
      THEN 'Unable to close tournament'
    ELSE COALESCE(NULLIF(trim(value->>'err_close_failed'), ''), 'Unable to close tournament')
  END,
  'err_start_failed',
  CASE
    WHEN COALESCE(trim(value->>'err_start_failed'), '') ~* 'event'
      THEN 'Unable to start tournament'
    ELSE COALESCE(NULLIF(trim(value->>'err_start_failed'), ''), 'Unable to start tournament')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'err_catalog_unavailable'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_event_not_found'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_event_not_editable'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_cannot_close'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_cannot_start'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_event_not_live'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_create_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_update_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_list_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_close_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'err_start_failed'), '') ~* 'event'
  );
