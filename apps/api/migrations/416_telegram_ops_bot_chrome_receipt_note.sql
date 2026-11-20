-- Bot chrome completeness + receipt review_note for Telegram reject reasons.

ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';

-- Extra bot/admin chrome keys (merge; never wipe ops secrets).
UPDATE platform_settings
SET value = value || jsonb_build_object(
  'menu_receipts_label', COALESCE(NULLIF(trim(value->>'menu_receipts_label'), ''), 'Dama Receipts'),
  'menu_payouts_label', COALESCE(NULLIF(trim(value->>'menu_payouts_label'), ''), 'Dama Payouts'),
  'menu_receipts_label_am', COALESCE(NULLIF(trim(value->>'menu_receipts_label_am'), ''), 'የDama ደረሰኞች'),
  'menu_payouts_label_am', COALESCE(NULLIF(trim(value->>'menu_payouts_label_am'), ''), 'የDama ክፍያ ጥያቄዎች'),
  'unknown_user_label', COALESCE(NULLIF(trim(value->>'unknown_user_label'), ''), 'Unknown'),
  'na_label', COALESCE(NULLIF(trim(value->>'na_label'), ''), 'N/A'),
  'reject_reason_prompt_receipt', COALESCE(NULLIF(trim(value->>'reject_reason_prompt_receipt'), ''), 'Enter the rejection reason for this receipt:'),
  'reject_reason_prompt_payout', COALESCE(NULLIF(trim(value->>'reject_reason_prompt_payout'), ''), 'Enter the rejection reason for this payout:'),
  'reject_cancelled', COALESCE(NULLIF(trim(value->>'reject_cancelled'), ''), 'Rejection cancelled.'),
  'approved_toast', COALESCE(NULLIF(trim(value->>'approved_toast'), ''), 'Approved'),
  'rejected_toast', COALESCE(NULLIF(trim(value->>'rejected_toast'), ''), 'Rejected'),
  'paid_toast', COALESCE(NULLIF(trim(value->>'paid_toast'), ''), 'Marked paid'),
  'err_fetch_failed', COALESCE(NULLIF(trim(value->>'err_fetch_failed'), ''), 'Failed to fetch from Dama API.'),
  'err_not_configured_env', COALESCE(NULLIF(trim(value->>'err_not_configured_env'), ''), 'DAMA_API_BASE_URL is not configured.'),
  'hub_found_template', COALESCE(NULLIF(trim(value->>'hub_found_template'), ''), 'Found {count} pending items:'),
  'admin_back_label', COALESCE(NULLIF(trim(value->>'admin_back_label'), ''), 'Admin')
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'telegram_ops_ready_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_ready_label'), ''), 'ready'),
    'telegram_ops_not_ready_label',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_not_ready_label'), ''), 'not ready'),
    'telegram_ops_status_joiner',
    COALESCE(NULLIF(trim(value->'payments'->>'telegram_ops_status_joiner'), ''), ' · ')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
