-- Ads money displays use DB amount_currency_separator (parity with wallet_chrome).
-- Copied from wallet_chrome when present; fail-closed empty not allowed after ready check.

UPDATE platform_settings AS ads
SET value = COALESCE(ads.value, '{}'::jsonb) || jsonb_build_object(
  'amount_currency_separator',
  COALESCE(
    NULLIF(trim(ads.value->>'amount_currency_separator'), ''),
    NULLIF(trim(wallet.value->>'amount_currency_separator'), ''),
    ' '
  )
),
    updated_at = NOW()
FROM platform_settings AS wallet
WHERE ads.key = 'ad_runtime_chrome'
  AND wallet.key = 'wallet_chrome';
