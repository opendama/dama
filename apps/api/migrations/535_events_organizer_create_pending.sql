-- Organizer create dialog: pending label for Create button (fail-closed; no client invent).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'create_pending',
  COALESCE(NULLIF(trim(value->>'create_pending'), ''), 'Creating…')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
