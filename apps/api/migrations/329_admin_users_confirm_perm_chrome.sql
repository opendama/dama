-- Users console: permission-gate labels, role/bulk confirms, DOB detail chrome.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb)
    || jsonb_build_object(
    'read_permission_key', COALESCE(NULLIF(trim(value->'users'->>'read_permission_key'), ''), 'users.read'),
    'write_role_permission_key', COALESCE(NULLIF(trim(value->'users'->>'write_role_permission_key'), ''), 'users.write_role'),
    'write_active_permission_key', COALESCE(NULLIF(trim(value->'users'->>'write_active_permission_key'), ''), 'users.write_active'),
    'lacks_read', COALESCE(NULLIF(trim(value->'users'->>'lacks_read'), ''), 'Your role lacks users.read.'),
    'confirm_role_title', COALESCE(NULLIF(trim(value->'users'->>'confirm_role_title'), ''), 'Change role?'),
    'confirm_role_description', COALESCE(NULLIF(trim(value->'users'->>'confirm_role_description'), ''), 'This updates the console role for the selected user.'),
    'confirm_role', COALESCE(NULLIF(trim(value->'users'->>'confirm_role'), ''), 'Change role'),
    'confirm_role_pending', COALESCE(NULLIF(trim(value->'users'->>'confirm_role_pending'), ''), 'Updating role…'),
    'bulk_confirm_activate_title', COALESCE(NULLIF(trim(value->'users'->>'bulk_confirm_activate_title'), ''), 'Activate selected users?'),
    'bulk_confirm_activate_description', COALESCE(NULLIF(trim(value->'users'->>'bulk_confirm_activate_description'), ''), 'Selected accounts will be marked active.'),
    'bulk_confirm_deactivate_title', COALESCE(NULLIF(trim(value->'users'->>'bulk_confirm_deactivate_title'), ''), 'Deactivate selected users?'),
    'bulk_confirm_deactivate_description', COALESCE(NULLIF(trim(value->'users'->>'bulk_confirm_deactivate_description'), ''), 'Selected accounts will be deactivated. Your own account is skipped.'),
    'detail_dob_label', COALESCE(NULLIF(trim(value->'users'->>'detail_dob_label'), ''), 'Date of birth')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome' AND value ? 'users';
