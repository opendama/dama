-- Admin hosted-events / reports tables: empty cells from DB (no UUID invent when name missing).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'empty_value',
  COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-')
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
