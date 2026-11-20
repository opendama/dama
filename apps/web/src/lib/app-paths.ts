/**
 * Edge-safe path helpers. Middleware cannot call the API on every request, so
 * paths come from NEXT_PUBLIC_APP_PATH_* that must stay aligned with
 * platform_settings.auth_providers.site.* (no invent defaults).
 */

function trimPath(value: string | undefined): string {
  return (value || "").trim();
}

/** Login path from env (aligned with site.path_login). Empty = unset. */
export function envPathLogin(): string {
  return trimPath(process.env.NEXT_PUBLIC_APP_PATH_LOGIN);
}

/** OAuth PKCE return path. Must never be behind an auth gate. */
export function envPathAuthCallback(): string {
  return trimPath(process.env.NEXT_PUBLIC_APP_PATH_AUTH_CALLBACK);
}

/** OAuth complete (dama JWT mint) path. */
export function envPathOAuthComplete(): string {
  return trimPath(process.env.NEXT_PUBLIC_APP_PATH_OAUTH_COMPLETE);
}
