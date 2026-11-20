-- Receipts list empty copy must not say "pending" when filtering Paid/All/Rejected.
-- Settled approved proofs display/filter as Paid (canonical DB status stays approved).
-- Fail-closed idempotent.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'no_receipts', COALESCE(
      NULLIF(trim(value->'payments'->>'no_receipts'), ''),
      'No receipts.'
    ),
    'receipts_empty_all', COALESCE(
      NULLIF(trim(value->'payments'->>'receipts_empty_all'), ''),
      'No receipts.'
    ),
    'receipts_empty_pending', COALESCE(
      NULLIF(trim(value->'payments'->>'receipts_empty_pending'), ''),
      'No pending receipts.'
    ),
    'receipts_empty_paid', COALESCE(
      NULLIF(trim(value->'payments'->>'receipts_empty_paid'), ''),
      'No paid receipts.'
    ),
    'receipts_empty_rejected', COALESCE(
      NULLIF(trim(value->'payments'->>'receipts_empty_rejected'), ''),
      'No rejected receipts.'
    ),
    'receipt_status_paid', COALESCE(
      NULLIF(trim(value->'payments'->>'receipt_status_paid'), ''),
      'Paid'
    ),
    'receipt_status_pending', COALESCE(
      NULLIF(trim(value->'payments'->>'receipt_status_pending'), ''),
      'Pending'
    ),
    'receipt_status_rejected', COALESCE(
      NULLIF(trim(value->'payments'->>'receipt_status_rejected'), ''),
      'Rejected'
    ),
    'receipt_status_approved', COALESCE(
      NULLIF(trim(value->'payments'->>'receipt_status_approved'), ''),
      'Approved'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

-- Force-replace legacy pending-only empty copy when still the old seed text.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments,no_receipts}',
  to_jsonb('No receipts.'::text),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND lower(trim(COALESCE(value->'payments'->>'no_receipts', ''))) IN (
    'no pending receipts.',
    'no pending receipts'
  );
