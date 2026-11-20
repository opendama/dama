-- Permission keys for client gates + RBAC lockout error chrome (DB only; no client invent).

UPDATE platform_settings
SET value = value || '{
  "manage_permission_key": "rbac.manage",
  "err_protected_delete": "Protected permission cannot be deleted",
  "err_protected_last_grant": "Cannot remove protected permission from the last role that holds it"
}'::jsonb,
updated_at = NOW()
WHERE key = 'rbac_chrome';

UPDATE platform_settings
SET value = value || '{
  "runtime_permission_key": "ads.manage_runtime",
  "campaigns_permission_key": "ads.manage_campaigns"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
