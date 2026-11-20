-- Refresh auth_providers chrome: social-only Google messaging; no client hardcodes needed.
-- login_subtitle + ensure oauth complete path present for fail-closed clients.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'login_title', 'Sign in with Google',
    'login_subtitle', 'Social sign-in only. Continue with Google to play, manage your wallet, or run ad campaigns.',
    'login_default_next', COALESCE(value->>'login_default_next', '/dashboard'),
    'providers', COALESCE(value->'providers', '["google"]'::jsonb),
    'providers_empty_message', COALESCE(value->>'providers_empty_message', 'No sign-in providers are enabled.'),
    'login_failed_message', COALESCE(value->>'login_failed_message', 'Sign in failed.'),
    'login_provider_disabled_message', COALESCE(value->>'login_provider_disabled_message', 'That sign-in provider is not enabled.'),
    'login_missing_supabase_env', COALESCE(value->>'login_missing_supabase_env', 'Supabase Auth is not configured.'),
    'login_oauth_exchange_failed', COALESCE(value->>'login_oauth_exchange_failed', 'Sign-in could not be completed. Try again.'),
    'login_oauth_email_missing', COALESCE(value->>'login_oauth_email_missing', 'Google did not share an email address. Grant email access and try again.'),
    'login_default_next_missing', COALESCE(value->>'login_default_next_missing', 'Sign-in destination is not configured.'),
    'login_auth_providers_unavailable', COALESCE(value->>'login_auth_providers_unavailable', 'Sign-in providers unavailable. Try again.'),
    'site', COALESCE(value->'site', '{}'::jsonb) || jsonb_build_object(
      'path_login', COALESCE(value#>>'{site,path_login}', '/auth/login'),
      'path_auth_callback', COALESCE(value#>>'{site,path_auth_callback}', '/auth/callback'),
      'path_oauth_complete', COALESCE(value#>>'{site,path_oauth_complete}', '/auth/oauth/complete'),
      'nav_sign_in_href', COALESCE(value#>>'{site,nav_sign_in_href}', '/auth/login')
    ),
    'google_oauth_access_type', COALESCE(value->>'google_oauth_access_type', 'offline'),
    'google_oauth_prompt', COALESCE(value->>'google_oauth_prompt', 'select_account'),
    'google_oauth_params_missing', COALESCE(value->>'google_oauth_params_missing', 'Google OAuth query params are not configured.'),
    'google_oauth_scopes_missing', COALESCE(value->>'google_oauth_scopes_missing', 'Google OAuth scopes are not configured.')
  ),
updated_at = NOW()
WHERE key = 'auth_providers';
