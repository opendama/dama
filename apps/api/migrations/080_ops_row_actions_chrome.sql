-- Trim OpsDataTableRowActions trigger labels (avatars + media pool).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{avatars}',
  COALESCE(value->'avatars', '{}'::jsonb) || '{
    "row_actions_label": "Row actions"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "row_actions_label": "Row actions"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
