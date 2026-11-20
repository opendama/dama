-- Smart-menu staff modal parity: copy identity fields (email/phone/id) chrome.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb)
    || jsonb_build_object(
    'copy_action', COALESCE(NULLIF(trim(value->'users'->>'copy_action'), ''), 'Copy'),
    'copied_action', COALESCE(NULLIF(trim(value->'users'->>'copied_action'), ''), 'Copied'),
    'copy_id_label', COALESCE(NULLIF(trim(value->'users'->>'copy_id_label'), ''), 'Copy id'),
    'copy_email_label', COALESCE(NULLIF(trim(value->'users'->>'copy_email_label'), ''), 'Copy email'),
    'copy_phone_label', COALESCE(NULLIF(trim(value->'users'->>'copy_phone_label'), ''), 'Copy phone')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome' AND value ? 'users';
