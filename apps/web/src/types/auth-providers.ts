export type AuthProviderItem = {
  id: string;
  display_name: string;
  action_label: string;
  pending_label: string;
};

export type AuthProvidersSiteChrome = {
  path_login?: string;
  path_auth_callback?: string;
  path_oauth_complete?: string;
  nav_sign_in_href?: string;
};

export type AuthProvidersResponse = {
  providers?: string[];
  login_title?: string;
  login_subtitle?: string;
  login_success_message?: string;
  login_default_next?: string;
  admin_login_default_next?: string;
  admin_login_title?: string;
  admin_login_default_next_missing?: string;
  nav_sign_in_label?: string;
  auth_required_message?: string;
  sign_out_action_label?: string;
  sign_out_pending?: string;
  login_oauth_email_denied?: string;
  providers_empty_message?: string;
  login_failed_message?: string;
  login_provider_disabled_message?: string;
  login_missing_supabase_env?: string;
  login_oauth_exchange_failed?: string;
  login_oauth_email_missing?: string;
  login_default_next_missing?: string;
  login_auth_providers_unavailable?: string;
  site?: AuthProvidersSiteChrome;
  items?: AuthProviderItem[];
  google_oauth_access_type?: string;
  google_oauth_prompt?: string;
  google_oauth_params_missing?: string;
  google_oauth_scopes_missing?: string;
  google_oauth_scopes?: string;
};
