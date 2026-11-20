-- Additional wallet/payout API error chrome (previously hardcoded).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'payout_method_not_set', COALESCE(
      NULLIF(TRIM(value->>'payout_method_not_set'), ''),
      'Payout method not set'
    ),
    'receipt_not_found', COALESCE(
      NULLIF(TRIM(value->>'receipt_not_found'), ''),
      'Receipt not found'
    )
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
