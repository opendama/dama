-- Sign-in CTA label + auth-required message (DB chrome; no client invent).

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'nav_sign_in_label', COALESCE(value->>'nav_sign_in_label', 'Sign in'),
  'auth_required_message', COALESCE(value->>'auth_required_message', 'Sign in required')
),
updated_at = NOW()
WHERE key = 'auth_providers';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'sign_in_required', COALESCE(value->>'sign_in_required', 'Sign in required'),
  'sign_in_required_checkout', COALESCE(value->>'sign_in_required_checkout', 'Sign in required for checkout')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';
