-- Organizer Manage branding: sponsor name empty-state placeholder (fail-closed).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'sponsor_name_placeholder',
  COALESCE(
    NULLIF(trim(value->>'sponsor_name_placeholder'), ''),
    'Acme Partners'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
