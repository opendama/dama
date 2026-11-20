-- Ops rematch / release-readiness chrome (ready or live unfinished matches only).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'rematch_action', COALESCE(NULLIF(trim(value->>'rematch_action'), ''), 'Rematch'),
  'rematch_pending', COALESCE(NULLIF(trim(value->>'rematch_pending'), ''), 'Resetting'),
  'err_rematch_failed', COALESCE(
    NULLIF(trim(value->>'err_rematch_failed'), ''),
    'Unable to reset match for rematch'
  )
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'rematch_action', COALESCE(NULLIF(trim(value->>'rematch_action'), ''), 'Rematch'),
  'rematch_pending', COALESCE(NULLIF(trim(value->>'rematch_pending'), ''), 'Resetting'),
  'toast_rematch_failed', COALESCE(
    NULLIF(trim(value->>'toast_rematch_failed'), ''),
    COALESCE(NULLIF(trim(value->>'err_rematch_failed'), ''), 'Unable to reset match for rematch')
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
