-- Wallet / banks: copy actions + toast chrome for manual transfer account cards (Smart Menu parity).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'copy_action', COALESCE(NULLIF(trim(value->>'copy_action'), ''), 'Copy'),
    'toast_copied', COALESCE(NULLIF(trim(value->>'toast_copied'), ''), 'Copied'),
    'toast_copy_failed', COALESCE(NULLIF(trim(value->>'toast_copy_failed'), ''), 'Copy failed'),
    'bank_copy_account_label', COALESCE(NULLIF(trim(value->>'bank_copy_account_label'), ''), 'Copy account number'),
    'bank_copy_mobile_label', COALESCE(NULLIF(trim(value->>'bank_copy_mobile_label'), ''), 'Copy mobile code'),
    'bank_copy_name_label', COALESCE(NULLIF(trim(value->>'bank_copy_name_label'), ''), 'Copy account name')
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb)
    || jsonb_build_object(
      'copy_action', COALESCE(NULLIF(trim(value->'banks'->>'copy_action'), ''), 'Copy'),
      'toast_copied', COALESCE(NULLIF(trim(value->'banks'->>'toast_copied'), ''), 'Copied'),
      'toast_copy_failed', COALESCE(NULLIF(trim(value->'banks'->>'toast_copy_failed'), ''), 'Copy failed'),
      'copy_account_label', COALESCE(NULLIF(trim(value->'banks'->>'copy_account_label'), ''), 'Copy account number'),
      'copy_mobile_label', COALESCE(NULLIF(trim(value->'banks'->>'copy_mobile_label'), ''), 'Copy mobile code')
    ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
