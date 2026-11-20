-- DB chrome for cash/wallet API errors previously hardcoded in REST handlers.
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'wallet_insufficient_balance', COALESCE(
      NULLIF(TRIM(value->>'wallet_insufficient_balance'), ''),
      'Insufficient wallet balance'
    ),
    'wallet_debit_failed', COALESCE(
      NULLIF(TRIM(value->>'wallet_debit_failed'), ''),
      'Unable to debit wallet'
    )
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
