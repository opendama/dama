-- Trim DataTable selection chrome + remove-country pending (OpsDataTable).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{avatars}',
  COALESCE(value->'avatars', '{}'::jsonb) || '{
    "select_all_label": "Select all",
    "select_row_label": "Select row",
    "selected_count_fmt": "{count} selected",
    "clear_selection_action": "Clear",
    "bulk_approve_action": "Approve selected",
    "bulk_approve_pending": "Approving…"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || '{
    "select_all_label": "Select all",
    "select_row_label": "Select row",
    "selected_count_fmt": "{count} selected",
    "clear_selection_action": "Clear",
    "bulk_activate_action": "Activate selected",
    "bulk_deactivate_action": "Deactivate selected",
    "bulk_status_pending": "Updating…"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "cash_allowed_countries_remove_pending": "Removing…"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
