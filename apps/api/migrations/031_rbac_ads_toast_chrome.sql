-- Admin toast copy for RBAC + ads runtime (no client-invented success/error strings).

UPDATE platform_settings
SET value = value || '{
  "toast_catalog_saved": "Role catalog saved",
  "toast_permission_saved": "Permission saved",
  "toast_permission_deleted": "Permission deleted",
  "toast_grants_saved": "Role permissions saved",
  "toast_save_failed": "Save failed",
  "toast_delete_failed": "Delete failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'rbac_chrome';

UPDATE platform_settings
SET value = value || '{
  "toast_playback_saved": "Ad playback saved",
  "toast_schedule_saved": "Campaign schedule saved",
  "toast_status_updated": "Campaign status updated",
  "toast_save_failed": "Save failed",
  "toast_update_failed": "Update failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
