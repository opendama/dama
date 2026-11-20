-- Media pool toast paren wrappers (fail closed).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "paren_open": " (",
    "paren_close": ")"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
