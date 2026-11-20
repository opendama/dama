-- Protected permission keys (DB-driven; cannot delete or orphan last grant).

UPDATE platform_settings
SET value = value || '{
  "protected_permission_keys": ["rbac.manage"]
}'::jsonb,
updated_at = NOW()
WHERE key = 'rbac_chrome';
