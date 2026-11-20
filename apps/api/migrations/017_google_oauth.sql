-- Google social sign-in via Supabase Auth.
-- password_hash dropped in 018 (social-only).

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider) WHERE auth_provider IS NOT NULL;

-- Public auth-providers chrome + allow-list (Google only for now).
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'auth_providers',
  '{
    "source": "database",
    "providers": ["google"],
    "login_title": "Sign in to dama",
    "login_default_next": "/dashboard",
    "providers_empty_message": "No sign-in providers are enabled.",
    "login_failed_message": "Sign in failed.",
    "login_provider_disabled_message": "That sign-in provider is not enabled.",
    "login_missing_supabase_env": "Supabase Auth is not configured.",
    "login_oauth_exchange_failed": "Sign-in could not be completed. Try again.",
    "login_oauth_email_missing": "Google did not share an email address. Grant email access and try again.",
    "login_default_next_missing": "Sign-in destination is not configured.",
    "login_auth_providers_unavailable": "Sign-in providers unavailable. Try again.",
    "site": {
      "path_login": "/auth/login",
      "path_auth_callback": "/auth/callback",
      "path_oauth_complete": "/auth/oauth/complete",
      "nav_sign_in_href": "/auth/login"
    },
    "items": [
      {
        "id": "google",
        "display_name": "Google",
        "action_label": "Continue with Google",
        "pending_label": "Redirecting to Google..."
      }
    ],
    "google_oauth_access_type": "offline",
    "google_oauth_prompt": "select_account",
    "google_oauth_params_missing": "Google OAuth query params are not configured.",
    "google_oauth_scopes_missing": "Google OAuth scopes are not configured."
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
