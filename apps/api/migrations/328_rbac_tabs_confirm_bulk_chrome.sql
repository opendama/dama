-- RBAC Trim-style tabs + permission delete confirm + bulk delete chrome.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'tab_catalog_label', COALESCE(NULLIF(trim(value->>'tab_catalog_label'), ''), COALESCE(NULLIF(trim(value->>'catalog_title'), ''), 'Role catalog')),
    'tab_permissions_label', COALESCE(NULLIF(trim(value->>'tab_permissions_label'), ''), COALESCE(NULLIF(trim(value->>'permissions_title'), ''), 'Permissions')),
    'tab_grants_label', COALESCE(NULLIF(trim(value->>'tab_grants_label'), ''), COALESCE(NULLIF(trim(value->>'grants_title'), ''), 'Role grants')),
    'confirm_delete_title', COALESCE(NULLIF(trim(value->>'confirm_delete_title'), ''), 'Delete permission?'),
    'confirm_delete_description', COALESCE(NULLIF(trim(value->>'confirm_delete_description'), ''), 'This removes the permission key from the catalog. Role grants that reference it must be updated separately.'),
    'confirm_delete', COALESCE(NULLIF(trim(value->>'confirm_delete'), ''), 'Delete'),
    'confirm_delete_pending', COALESCE(NULLIF(trim(value->>'confirm_delete_pending'), ''), 'Deleting…'),
    'confirm_cancel', COALESCE(NULLIF(trim(value->>'confirm_cancel'), ''), COALESCE(NULLIF(trim(value->>'cancel_action'), ''), 'Cancel')),
    'bulk_delete_action', COALESCE(NULLIF(trim(value->>'bulk_delete_action'), ''), 'Delete selected'),
    'bulk_delete_pending', COALESCE(NULLIF(trim(value->>'bulk_delete_pending'), ''), 'Deleting…'),
    'bulk_delete_confirm_title', COALESCE(NULLIF(trim(value->>'bulk_delete_confirm_title'), ''), 'Delete selected permissions?'),
    'bulk_delete_confirm_description', COALESCE(NULLIF(trim(value->>'bulk_delete_confirm_description'), ''), 'Protected permission keys are skipped. This cannot be undone from the console.')
  ),
  updated_at = NOW()
WHERE key = 'rbac_chrome';
