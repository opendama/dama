import type { AuthProvidersResponse } from "@/types/auth-providers";
import { playerTournamentDiscoveryHref } from "./competition-cup-source";

/** Provider ids come only from auth-providers API (Google-only while DB lists google). */
export type AuthProviderId = string;

function parseProviderList(raw: string[]): AuthProviderId[] {
  return raw.map((p) => p.trim().toLowerCase()).filter(Boolean);
}

export type AllowedAuthProvidersResult = {
  ok: boolean;
  providers: AuthProviderId[];
  chrome: AuthProvidersResponse | null;
};

/** Database-only allow-list + chrome from GET /public/auth-providers. No env fallback. */
export async function fetchAllowedAuthProviders(
  apiBase?: string,
): Promise<AllowedAuthProvidersResult> {
  const base = (apiBase || process.env.NEXT_PUBLIC_REST_URL || "").replace(/\/$/, "");
  if (!base) return { ok: false, providers: [], chrome: null };
  try {
    const res = await fetch(`${base}/public/auth-providers`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, providers: [], chrome: null };
    const body = (await res.json()) as AuthProvidersResponse;
    return {
      ok: true,
      providers: parseProviderList(body.providers ?? []),
      chrome: body,
    };
  } catch {
    return { ok: false, providers: [], chrome: null };
  }
}

export function isAllowedAuthProvider(
  provider: string | undefined | null,
  allowList: AuthProviderId[] | undefined,
): boolean {
  if (!provider || !allowList || allowList.length === 0) return false;
  return allowList.includes(provider.toLowerCase());
}

export function isSafeAppPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

/**
 * Normalize a post-login path; reject auth routes and unsafe values.
 * Never keep `/dashboard` as an OAuth return - portal is opened intentionally
 * from the signed-in Overview menu, not as a post-login dump.
 */
export function sanitizeLoginNext(next: string | null | undefined, fallback = "/"): string {
  let path = (next || "").trim();
  if (!path || !isSafeAppPath(path) || path.startsWith("/auth/")) {
    path = (fallback || "/").trim() || "/";
  }
  if (path === "/dashboard" || path.startsWith("/dashboard?")) {
    path = "/";
  }
  // Legacy Events browse must not survive OAuth / sign-in return (one Tournament word).
  path = playerTournamentDiscoveryHref(path);
  if (!isSafeAppPath(path) || path.startsWith("/auth/")) {
    return "/";
  }
  return path;
}

/** Alias: casual defaults use the same rules as sanitizeLoginNext. */
export function sanitizeCasualLoginDefault(
  next: string | null | undefined,
  fallback = "/",
): string {
  return sanitizeLoginNext(next, fallback);
}

/** Resolve login path from auth-providers chrome only (fail closed → empty). */
export function resolveLoginPath(chrome: AuthProvidersResponse | null | undefined): string {
  const fromApi = (chrome?.site?.path_login || chrome?.site?.nav_sign_in_href || "").trim();
  if (fromApi && isSafeAppPath(fromApi)) return fromApi;
  return "";
}

/** Resolve oauth-complete path from chrome only. */
export function resolveOAuthCompletePath(chrome: AuthProvidersResponse | null | undefined): string {
  const fromApi = (chrome?.site?.path_oauth_complete || "").trim();
  if (fromApi && isSafeAppPath(fromApi)) return fromApi;
  return "";
}
