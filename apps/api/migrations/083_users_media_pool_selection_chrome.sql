-- Trim OpsDataTable selection chrome for users + media_pool (fan-out bulk).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || '{
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
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "select_all_label": "Select all",
    "select_row_label": "Select row",
    "selected_count_fmt": "{count} selected",
    "clear_selection_action": "Clear",
    "bulk_activate_action": "Restore selected",
    "bulk_deactivate_action": "Remove selected",
    "bulk_status_pending": "Updating…"
  }'::jsonb,
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
