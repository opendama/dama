-- OAuth exchange API errors from auth_providers (no invent English codes in oauth_handlers).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_access_token_required": "Access token is required",
  "err_invalid_oauth_token": "Invalid sign-in token",
  "err_email_policy_unavailable": "Email policy unavailable",
  "err_oauth_email_denied": "This email domain is not allowed",
  "err_default_role_unavailable": "Default role unavailable",
  "err_username_unavailable": "Unable to derive username",
  "err_account_create_failed": "Unable to create account",
  "err_sign_in_incomplete": "Unable to complete sign-in",
  "err_account_disabled": "Account disabled",
  "err_token_issue_failed": "Unable to issue session"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'auth_providers';
