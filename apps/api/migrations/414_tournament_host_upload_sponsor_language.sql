-- Mig 414: Force Hosting upload_sponsor_failed off Event sport.
-- Logo path was healed in 413 + softHostingUploadLogoFailed; sponsor upload still
-- painted raw chrome (web+Flutter). softHostingUploadSponsorFailed fail-open at paint.
-- Idempotent. Admin ops Event language unchanged. Backend tables unmerged.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'upload_sponsor_failed',
  CASE
    WHEN COALESCE(trim(value->>'upload_sponsor_failed'), '') ~* 'event'
      THEN 'Could not upload sponsor logo'
    ELSE COALESCE(NULLIF(trim(value->>'upload_sponsor_failed'), ''), 'Could not upload sponsor logo')
  END
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome'
  AND (
    COALESCE(trim(value->>'upload_sponsor_failed'), '') ~* 'event'
    OR COALESCE(trim(value->>'upload_sponsor_failed'), '') = ''
  );
