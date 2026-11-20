-- Payment/enroll modal money joins use DB amount_currency_separator (parity with wallet).

UPDATE platform_settings AS pm
SET value = COALESCE(pm.value, '{}'::jsonb) || jsonb_build_object(
  'amount_currency_separator',
  COALESCE(
    NULLIF(trim(pm.value->>'amount_currency_separator'), ''),
    NULLIF(trim(wallet.value->>'amount_currency_separator'), ''),
    ' '
  )
),
    updated_at = NOW()
FROM platform_settings AS wallet
WHERE pm.key = 'payment_modal_chrome'
  AND wallet.key = 'wallet_chrome';
