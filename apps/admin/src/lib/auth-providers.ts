import type { AuthProvidersResponse } from "@/types/auth-providers";

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

export function resolveLoginPath(chrome: AuthProvidersResponse | null | undefined): string {
  const fromApi = (chrome?.site?.path_login || chrome?.site?.nav_sign_in_href || "").trim();
  if (fromApi && isSafeAppPath(fromApi)) return fromApi;
  return "";
}

export function resolveOAuthCompletePath(chrome: AuthProvidersResponse | null | undefined): string {
  const fromApi = (chrome?.site?.path_oauth_complete || "").trim();
  if (fromApi && isSafeAppPath(fromApi)) return fromApi;
  return "";
}
