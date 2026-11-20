-- Admin Payments: payout status display labels + empty_value (no raw-code invent).
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || '{
    "empty_value": "-",
    "payout_history_pending": "Pending",
    "payout_history_approved": "Approved",
    "payout_history_rejected": "Rejected",
    "payout_history_paid": "Paid"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
