-- Users OpsDataTable column + row-actions chrome (Trim parity; no invented English headers).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || '{
    "col_user_label": "User",
    "col_record_label": "Record",
    "col_status_label": "Status",
    "col_role_label": "Role",
    "row_actions_label": "Row actions"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
