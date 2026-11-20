-- Admin overview KPI empty cells must use DB chrome (no client invent "-").
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '{}'::jsonb) || jsonb_build_object(
    'empty_value',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'empty_value'), ''),
      '-'
    )
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
