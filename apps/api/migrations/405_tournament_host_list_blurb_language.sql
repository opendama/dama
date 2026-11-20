-- Mig 405: Hosting list/dashboard blurb + empty_list + toast_created - Tournament wording.
-- Soft-fill if Event-sport regresses. Complements 401–404. Idempotent.
-- Backend tables unmerged. Admin Events catalog unchanged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'dashboard_blurb',
  CASE
    WHEN COALESCE(trim(value->>'dashboard_blurb'), '') ~* 'event'
      THEN 'Create and run branded checkers cups.'
    ELSE COALESCE(NULLIF(trim(value->>'dashboard_blurb'), ''), 'Create and run branded checkers cups.')
  END,
  'list_blurb',
  CASE
    WHEN COALESCE(trim(value->>'list_blurb'), '') ~* 'event'
      THEN 'Hosted cups you created and paid for.'
    ELSE COALESCE(NULLIF(trim(value->>'list_blurb'), ''), 'Hosted cups you created and paid for.')
  END,
  'empty_list',
  CASE
    WHEN COALESCE(trim(value->>'empty_list'), '') ~* 'event'
      THEN 'No hosted tournaments yet.'
    ELSE COALESCE(NULLIF(trim(value->>'empty_list'), ''), 'No hosted tournaments yet.')
  END,
  'toast_created',
  CASE
    WHEN COALESCE(trim(value->>'toast_created'), '') ~* 'event'
      THEN 'Tournament created'
    ELSE COALESCE(NULLIF(trim(value->>'toast_created'), ''), 'Tournament created')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'dashboard_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'list_blurb'), '') ~* 'event'
    OR COALESCE(trim(value->>'empty_list'), '') ~* 'event'
    OR COALESCE(trim(value->>'toast_created'), '') ~* 'event'
  );
