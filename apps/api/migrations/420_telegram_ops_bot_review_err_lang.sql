-- Review failure chrome + reject keyboard lang (no English err.Error / hardcoded "en").

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'err_receipt_review_failed', COALESCE(NULLIF(trim(value->>'err_receipt_review_failed'), ''), 'Receipt review failed'),
  'err_payout_review_failed', COALESCE(NULLIF(trim(value->>'err_payout_review_failed'), ''), 'Payout review failed'),
  'reject_keyboard_lang', COALESCE(NULLIF(trim(value->>'reject_keyboard_lang'), ''), 'en')
),
    updated_at = NOW()
WHERE key = 'telegram_ops_bot';
