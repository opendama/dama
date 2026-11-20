-- Settled approved proofs display as Paid (gateway intent parity).
-- Filter status=paid maps to payment_receipts.status=approved server-side.
-- Labels for admin + player wallet chrome; fail-closed idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'receipt_status_paid', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_paid'), ''), 'Paid'),
    'receipt_status_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_pending'), ''), 'Pending'),
    'receipt_status_approved', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_approved'), ''), 'Approved'),
    'receipt_status_rejected', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_rejected'), ''), 'Rejected'),
    'txn_status_paid', COALESCE(NULLIF(trim(value->'payments'->>'txn_status_paid'), ''), 'Paid')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_status_paid', COALESCE(NULLIF(trim(value->>'list_status_paid'), ''), 'Paid'),
  'list_status_approved', COALESCE(NULLIF(trim(value->>'list_status_approved'), ''), 'Approved'),
  'list_status_pending', COALESCE(NULLIF(trim(value->>'list_status_pending'), ''), 'Pending'),
  'list_status_rejected', COALESCE(NULLIF(trim(value->>'list_status_rejected'), ''), 'Rejected')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';
