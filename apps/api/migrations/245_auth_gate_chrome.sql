-- Auth middleware 401/403 copy from DB (stop invent {"error":"unauthorized"} / "forbidden").
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required",
  "err_forbidden": "Access denied"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'auth_providers';
