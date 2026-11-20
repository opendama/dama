-- Mig 413: Force Hosting patch_title_locked / upload_logo_failed off Event sport.
-- Root cause: mig 184 ||-seeds "while the event is open" / "upload event logo" every
-- migrateonly; mig 380 force-fill WHERE only matched brand/title/search/list keys,
-- so once those were Tournament-safe these two keys never soft-filled.
-- softHostingPatchTitleLocked / softHostingUploadLogoFailed still fail-open at paint.
-- Idempotent. Admin ops Event language unchanged. Backend tables unmerged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'patch_title_locked',
  CASE
    WHEN COALESCE(trim(value->>'patch_title_locked'), '') ~* 'event'
      THEN 'Title can only change while the tournament is open'
    ELSE COALESCE(NULLIF(trim(value->>'patch_title_locked'), ''), 'Title can only change while the tournament is open')
  END,
  'upload_logo_failed',
  CASE
    WHEN COALESCE(trim(value->>'upload_logo_failed'), '') ~* 'event'
      THEN 'Could not upload tournament logo'
    ELSE COALESCE(NULLIF(trim(value->>'upload_logo_failed'), ''), 'Could not upload tournament logo')
  END,
  'analytics_title',
  CASE
    WHEN COALESCE(trim(value->>'analytics_title'), '') ~* 'event'
      THEN 'Hosting analytics'
    ELSE COALESCE(NULLIF(trim(value->>'analytics_title'), ''), 'Hosting analytics')
  END,
  'analytics_empty',
  CASE
    WHEN COALESCE(trim(value->>'analytics_empty'), '') ~* 'event'
      THEN 'No hosted tournaments yet.'
    ELSE COALESCE(NULLIF(trim(value->>'analytics_empty'), ''), 'No hosted tournaments yet.')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'patch_title_locked'), '') ~* 'event'
    OR COALESCE(trim(value->>'upload_logo_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'analytics_title'), '') ~* 'event'
    OR COALESCE(trim(value->>'analytics_empty'), '') ~* 'event'
  );
