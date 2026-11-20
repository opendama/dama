-- Public email-policy gate + sign-out / signed-in chrome (DB only).

CREATE TABLE IF NOT EXISTS email_domain_denylist (
  domain TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION email_domain_is_denied(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  d TEXT;
BEGIN
  p_email := lower(trim(coalesce(p_email, '')));
  IF p_email = '' OR position('@' IN p_email) < 2 THEN
    RETURN TRUE;
  END IF;
  d := split_part(p_email, '@', 2);
  IF d = '' OR position('@' IN d) > 0 THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (SELECT 1 FROM email_domain_denylist WHERE domain = d);
END;
$$;

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'sign_out_action_label', COALESCE(value->>'sign_out_action_label', 'Sign out'),
  'signed_in_as_prefix', COALESCE(value->>'signed_in_as_prefix', 'Signed in as'),
  'login_oauth_email_denied', COALESCE(
    value->>'login_oauth_email_denied',
    'That email domain is not allowed. Use a different Google account.'
  )
),
updated_at = NOW()
WHERE key = 'auth_providers';
