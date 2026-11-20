-- Telegram ops bot: status gates, API error chrome, HTTP timeout - no inventing fallbacks.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'receipt_pending_status', COALESCE(NULLIF(trim(value->>'receipt_pending_status'), ''), 'pending'),
  'http_client_timeout_seconds', COALESCE((value->>'http_client_timeout_seconds')::int, 30),
  'err_bot_not_initialized', COALESCE(NULLIF(trim(value->>'err_bot_not_initialized'), ''), 'Bot not initialized'),
  'err_unavailable', COALESCE(NULLIF(trim(value->>'err_unavailable'), ''), 'telegram_ops_bot unavailable'),
  'err_bot_request_failed', COALESCE(NULLIF(trim(value->>'err_bot_request_failed'), ''), 'bot request failed'),
  'err_payments_unavailable', COALESCE(NULLIF(trim(value->>'err_payments_unavailable'), ''), 'payments unavailable'),
  'err_payouts_unavailable', COALESCE(NULLIF(trim(value->>'err_payouts_unavailable'), ''), 'payouts unavailable'),
  'err_receipt_not_found', COALESCE(NULLIF(trim(value->>'err_receipt_not_found'), ''), 'receipt not found'),
  'err_payout_not_found', COALESCE(NULLIF(trim(value->>'err_payout_not_found'), ''), 'payout not found'),
  'err_invalid_payout_transition', COALESCE(NULLIF(trim(value->>'err_invalid_payout_transition'), ''), 'invalid payout transition'),
  'err_invalid_payout_status', COALESCE(NULLIF(trim(value->>'err_invalid_payout_status'), ''), 'invalid payout status'),
  'err_refund_failed_prefix', COALESCE(NULLIF(trim(value->>'err_refund_failed_prefix'), ''), 'refund failed:')
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
