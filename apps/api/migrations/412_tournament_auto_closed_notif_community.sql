-- Mig 412: player.event_auto_closed → Community tournaments (parity event_finished).
-- Seeded at /events/list then drifted to host portal /events/events; players who
-- played the cup should open Community discovery with join code, not Hosting manage.
-- Also force Hosting close/reopen chrome off Event sport (189 seed hardened).
-- Idempotent. Admin ops Event language unchanged. Backend tables unmerged.

UPDATE notification_kinds
SET href_path = '/?view=tournaments&source=community',
    href_query_key = 'code',
    title_template = CASE
      WHEN title_template ILIKE '%event%' THEN 'Tournament finished'
      ELSE title_template
    END
WHERE code = 'player.event_auto_closed'
  AND (
    href_path IS DISTINCT FROM '/?view=tournaments&source=community'
    OR COALESCE(href_query_key, '') IS DISTINCT FROM 'code'
    OR title_template ILIKE '%event%'
  );

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'close_action',
  CASE
    WHEN COALESCE(trim(value->>'close_action'), '') ~* 'event'
      THEN 'Close tournament'
    ELSE COALESCE(NULLIF(trim(value->>'close_action'), ''), 'Close tournament')
  END,
  'reopen_action',
  CASE
    WHEN COALESCE(trim(value->>'reopen_action'), '') ~* 'event'
      THEN 'Reopen tournament'
    ELSE COALESCE(NULLIF(trim(value->>'reopen_action'), ''), 'Reopen tournament')
  END,
  'cannot_reopen_blurb',
  CASE
    WHEN COALESCE(trim(value->>'cannot_reopen_blurb'), '') ~* 'event'
      THEN 'This tournament already ran or finished and cannot be reopened.'
    ELSE COALESCE(NULLIF(trim(value->>'cannot_reopen_blurb'), ''), 'This tournament already ran or finished and cannot be reopened.')
  END,
  'toast_closed',
  CASE
    WHEN COALESCE(trim(value->>'toast_closed'), '') ~* 'event'
      THEN 'Tournament closed'
    ELSE COALESCE(NULLIF(trim(value->>'toast_closed'), ''), 'Tournament closed')
  END,
  'toast_reopened',
  CASE
    WHEN COALESCE(trim(value->>'toast_reopened'), '') ~* 'event'
      THEN 'Tournament reopened'
    ELSE COALESCE(NULLIF(trim(value->>'toast_reopened'), ''), 'Tournament reopened')
  END,
  'toast_close_failed',
  CASE
    WHEN COALESCE(trim(value->>'toast_close_failed'), '') ~* 'event'
      THEN 'Could not close tournament'
    ELSE COALESCE(NULLIF(trim(value->>'toast_close_failed'), ''), 'Could not close tournament')
  END,
  'toast_reopen_failed',
  CASE
    WHEN COALESCE(trim(value->>'toast_reopen_failed'), '') ~* 'event'
      THEN 'Could not reopen tournament'
    ELSE COALESCE(NULLIF(trim(value->>'toast_reopen_failed'), ''), 'Could not reopen tournament')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'close_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'reopen_action'), '') ~* 'event'
    OR COALESCE(trim(value->>'cannot_reopen_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'toast_closed'), '') ~* 'event'
    OR COALESCE(trim(value->>'toast_reopened'), '') ~* 'event'
    OR COALESCE(trim(value->>'toast_close_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'toast_reopen_failed'), '') ~* 'event'
  );
