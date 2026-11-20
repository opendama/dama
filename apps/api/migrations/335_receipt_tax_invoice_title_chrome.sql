-- Trim title naming parity: document title = Tax invoice (wallet + admin payments).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_document_title', 'Tax invoice'
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_document_title', 'Tax invoice'
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
