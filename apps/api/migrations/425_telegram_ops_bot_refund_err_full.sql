-- 425: Payout-reject refund failure must be a complete operator chrome string.
-- Legacy key err_refund_failed_prefix is kept for DB continuity; Go never appends err.Error().
-- Upgrade the truncated seed "refund failed:" to a full message when still at that default.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_refund_failed_prefix',
  CASE
    WHEN NULLIF(trim(value->>'err_refund_failed_prefix'), '') IS NULL
      OR lower(trim(value->>'err_refund_failed_prefix')) IN ('refund failed:', 'refund failed')
    THEN 'Wallet refund after payout reject failed.'
    ELSE trim(value->>'err_refund_failed_prefix')
  END
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
