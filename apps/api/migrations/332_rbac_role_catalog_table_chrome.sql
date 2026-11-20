-- Role catalog tab: OpsDataTable + view/edit/create modal chrome (fail-closed; no client invent).

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'col_role_label', COALESCE(NULLIF(trim(value->>'col_role_label'), ''), COALESCE(NULLIF(trim(value->>'role_label'), ''), 'Role')),
    'col_console_label', COALESCE(NULLIF(trim(value->>'col_console_label'), ''), 'Console'),
    'col_publisher_label', COALESCE(NULLIF(trim(value->>'col_publisher_label'), ''), 'Publisher'),
    'col_default_label', COALESCE(NULLIF(trim(value->>'col_default_label'), ''), 'Default'),
    'add_role_action', COALESCE(NULLIF(trim(value->>'add_role_action'), ''), 'Add role'),
    'catalog_empty', COALESCE(NULLIF(trim(value->>'catalog_empty'), ''), 'No roles'),
    'flag_yes_label', COALESCE(NULLIF(trim(value->>'flag_yes_label'), ''), 'Yes'),
    'flag_no_label', COALESCE(NULLIF(trim(value->>'flag_no_label'), ''), 'No'),
    'delete_role_action', COALESCE(NULLIF(trim(value->>'delete_role_action'), ''), COALESCE(NULLIF(trim(value->>'confirm_delete'), ''), 'Delete')),
    'confirm_delete_role_title', COALESCE(NULLIF(trim(value->>'confirm_delete_role_title'), ''), 'Delete role?'),
    'confirm_delete_role_description', COALESCE(NULLIF(trim(value->>'confirm_delete_role_description'), ''), 'Removes this role from the catalog. Roles still assigned to users cannot be deleted.'),
    'bulk_delete_roles_confirm_title', COALESCE(NULLIF(trim(value->>'bulk_delete_roles_confirm_title'), ''), 'Delete selected roles?'),
    'bulk_delete_roles_confirm_description', COALESCE(NULLIF(trim(value->>'bulk_delete_roles_confirm_description'), ''), 'Roles still assigned to users are skipped. The default role cannot be removed until another default is set.'),
    'is_console_label', COALESCE(NULLIF(trim(value->>'is_console_label'), ''), 'Console access'),
    'is_publisher_label', COALESCE(NULLIF(trim(value->>'is_publisher_label'), ''), 'Publisher access'),
    'is_default_label', COALESCE(NULLIF(trim(value->>'is_default_label'), ''), COALESCE(NULLIF(trim(value->>'default_role_label'), ''), 'Default role')),
    'upsert_role_action', COALESCE(NULLIF(trim(value->>'upsert_role_action'), ''), COALESCE(NULLIF(trim(value->>'save_catalog_action'), ''), 'Save role')),
    'upsert_role_pending', COALESCE(NULLIF(trim(value->>'upsert_role_pending'), ''), COALESCE(NULLIF(trim(value->>'save_catalog_pending'), ''), 'Saving…')),
    'role_detail_title', COALESCE(
      NULLIF(trim(value->>'role_detail_title'), ''),
      CASE
        WHEN lower(trim(COALESCE(value->>'detail_title', ''))) IN ('permission details', 'permission detail')
          THEN 'Role details'
        ELSE NULLIF(trim(value->>'detail_title'), '')
      END,
      'Role details'
    )
  ),
  updated_at = NOW()
WHERE key = 'rbac_chrome';
