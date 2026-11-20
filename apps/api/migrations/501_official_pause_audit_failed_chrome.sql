-- Soft-fill audit failure chrome for official pause/resume/meta (fail-closed clients).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_audit_failed', COALESCE(
    NULLIF(trim(value->>'err_audit_failed'), ''),
    'Could not record the pause action. Try again.'
  )
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
