-- Wallet list/detail empty cells must use DB chrome (no client invent "-").
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'empty_value',
    COALESCE(NULLIF(trim(value->>'empty_value'), ''), '-')
  ),
  updated_at = NOW()
WHERE key = 'wallet_chrome';
