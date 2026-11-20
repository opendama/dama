-- Guest session + store compliance API errors from DB (no invent Guest/unauthorized/deletion English).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "guest_username": "Guest",
  "err_auth_unavailable": "Sign-in unavailable",
  "err_invalid_json": "Invalid request body",
  "err_e2e_identity_required": "Username and email are required"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'auth_providers';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'store_compliance_chrome';
