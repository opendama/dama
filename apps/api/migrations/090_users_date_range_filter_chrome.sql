-- Trim-parity users list filters: created date range chrome (fail-closed labels).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb)
    || jsonb_build_object(
      'date_range_label', COALESCE(value->'users'->>'date_range_label', 'Created'),
      'date_range_placeholder', COALESCE(value->'users'->>'date_range_placeholder', 'Pick a date range'),
      'date_range_clear', COALESCE(value->'users'->>'date_range_clear', 'Clear'),
      'date_range_apply', COALESCE(value->'users'->>'date_range_apply', 'Apply'),
      'date_range_months', COALESCE(value->'users'->>'date_range_months', '2'),
      'date_range_locale', COALESCE(value->'users'->>'date_range_locale', 'en')
    ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'users';
