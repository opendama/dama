-- Organizer manage/create save button labels (never reuse toast_saved as a button).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'save_action',
    COALESCE(NULLIF(trim(value->>'save_action'), ''), 'Save'),
    'save_pending',
    COALESCE(NULLIF(trim(value->>'save_pending'), ''), 'Saving…')
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';
