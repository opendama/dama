-- Remaining admin console mutation toasts (fail closed; no client invent).

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{users}',
    COALESCE(value->'users', '{}'::jsonb) || '{
      "toast_user_activated": "User activated",
      "toast_user_deactivated": "User deactivated"
    }'::jsonb,
    true
  ),
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "toast_upload_complete": "Upload complete",
    "toast_upload_failed": "Upload failed"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
