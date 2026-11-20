-- Admin banks detail: copy account-name label (Smart Menu / wallet copy parity).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb)
    || jsonb_build_object(
      'copy_name_label', COALESCE(NULLIF(trim(value->'banks'->>'copy_name_label'), ''), 'Copy account name')
    ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
