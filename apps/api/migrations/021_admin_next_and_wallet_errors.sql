-- Admin default-next chrome + wallet chrome error strings (fail closed; no client invent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'admin_login_default_next', COALESCE(value->>'admin_login_default_next', '/dashboard'),
  'admin_login_title', COALESCE(value->>'admin_login_title', 'Console sign in'),
  'admin_login_default_next_missing', COALESCE(
    value->>'admin_login_default_next_missing',
    'Console sign-in destination is not configured.'
  ),
  'nav_sign_in_label', COALESCE(value->>'nav_sign_in_label', 'Sign in'),
  'auth_required_message', COALESCE(value->>'auth_required_message', 'Sign in required')
),
updated_at = NOW()
WHERE key = 'auth_providers';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'payout_method_save_failed', COALESCE(value->>'payout_method_save_failed', 'Unable to save payout method'),
  'payout_request_failed', COALESCE(value->>'payout_request_failed', 'Unable to create payout request'),
  'payout_amount_currency_required', COALESCE(
    value->>'payout_amount_currency_required',
    'Amount and currency required'
  ),
  'wallet_chrome_unavailable', COALESCE(value->>'wallet_chrome_unavailable', 'Wallet chrome unavailable')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';
