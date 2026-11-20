-- Organizer hosted-event forfeit / DQ chrome (idempotent). Tournament console already has forfeit_action.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'forfeit_action', COALESCE(NULLIF(trim(value->>'forfeit_action'), ''), 'Forfeit'),
  'forfeit_pending', COALESCE(NULLIF(trim(value->>'forfeit_pending'), ''), 'Forfeiting'),
  'toast_forfeit_failed', COALESCE(
    NULLIF(trim(value->>'toast_forfeit_failed'), ''),
    COALESCE(NULLIF(trim(value->>'err_forfeit_failed'), ''), 'Unable to forfeit match')
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
