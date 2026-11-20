-- Trim invoice-details parity:
-- - Transaction label (was Receipt ID) mirrors Trim "Transaction:"
-- - Billing period label available when a period exists (wallet top-ups omit the row)
-- Letterhead merchant_via stays for under-logo subtitle; Payment method line uses
-- gateway display labels in app code (not this chrome string).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_label_id', 'Transaction',
  'receipt_label_billing_period', COALESCE(
    NULLIF(trim(value->>'receipt_label_billing_period'), ''),
    'Billing period'
  )
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_label_id', 'Transaction',
    'receipt_label_billing_period', COALESCE(
      NULLIF(trim(value->'payments'->>'receipt_label_billing_period'), ''),
      'Billing period'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
