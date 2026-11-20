-- Admin console RBAC/ad runtime + remaining CRUD pending labels (Trim Button isLoading + pendingLabel).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{feature_flags}',
  COALESCE(value->'feature_flags', '{}'::jsonb) || '{
    "save_depths_pending": "Saving…",
    "toggle_pending": "Updating…",
    "cash_disabled_countries_save_pending": "Saving…",
    "cash_allowed_countries_save_pending": "Saving…",
    "cash_allowed_countries_add_pending": "Adding…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "add_channel_pending": "Adding…",
    "run_upload_pending": "Uploading…",
    "test_readiness_pending": "Testing…",
    "status_update_pending": "Updating…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "save_platform_pending": "Saving…",
    "save_board_pending": "Saving…"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || '{
  "save_catalog_pending": "Saving…",
  "upsert_permission_pending": "Saving…",
  "delete_permission_pending": "Deleting…",
  "save_grants_pending": "Saving…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'rbac_chrome';

UPDATE platform_settings
SET value = value || '{
  "save_pending": "Saving…",
  "save_campaign_schedule_pending": "Saving…",
  "update_status_pending": "Updating…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
