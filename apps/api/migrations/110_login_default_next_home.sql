-- Casual social sign-in returns to Play home, not the player portal.
-- Portal pages pass an explicit next path when auth is required.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{login_default_next}',
  '"/"'::jsonb
),
updated_at = NOW()
WHERE key = 'auth_providers'
  AND COALESCE(value->>'login_default_next', '') IN ('', '/dashboard');
