-- Dedicated admin error when player web_app_origin is missing/invalid.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "err_web_app_origin": "Player web app origin must be an http(s) URL"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
