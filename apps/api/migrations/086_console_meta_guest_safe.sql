-- Guest-safe console document meta (no "control console" wording on login/document).
UPDATE platform_settings
SET value = value || '{
  "meta_description": "dama Console. Feature flags, payments, media pool, RBAC."
}'::jsonb,
updated_at = NOW()
WHERE key = 'console_nav';
