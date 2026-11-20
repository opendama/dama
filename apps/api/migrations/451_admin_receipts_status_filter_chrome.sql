-- Admin receipts Ops filters: All sentinel + status labels (pending/approved/rejected).
-- List endpoint accepts optional status; empty = all (so reviewed rows stay visible).

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'filter_all_label', COALESCE(NULLIF(trim(value->'payments'->>'filter_all_label'), ''), 'All'),
    'receipt_status_pending', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_pending'), ''), 'Pending'),
    'receipt_status_approved', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_approved'), ''), 'Approved'),
    'receipt_status_rejected', COALESCE(NULLIF(trim(value->'payments'->>'receipt_status_rejected'), ''), 'Rejected')
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
