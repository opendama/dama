-- Wallet/payout API error chrome (stop English invent on money routes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_invalid_json": "Invalid request body",
  "err_unauthorized": "Sign in required",
  "err_not_found": "Not found",
  "err_tx_ref_required": "Payment reference required",
  "err_invalid_signature": "Invalid payment signature"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';
