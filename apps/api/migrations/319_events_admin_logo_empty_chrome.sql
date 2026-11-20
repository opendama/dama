-- Events admin detail logo captions; progression/rbac empty_value (fail-closed, no TS invent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'detail_logo_label', COALESCE(
    NULLIF(trim(value->>'detail_logo_label'), ''),
    NULLIF(trim(value->>'logo_label'), ''),
    'Event logo'
  ),
  'detail_sponsor_logo_label', COALESCE(
    NULLIF(trim(value->>'detail_sponsor_logo_label'), ''),
    NULLIF(trim(value->>'sponsor_logo_label'), ''),
    'Sponsor logo'
  )
),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'progression'->>'empty_value'), ''), '-')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'empty_value', COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-')
),
  updated_at = NOW()
WHERE key = 'rbac_chrome';
