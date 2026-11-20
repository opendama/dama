import { envPathLogin } from "@/lib/app-paths";
import {
  type AllowedAuthProvidersResult,
  fetchAllowedAuthProviders,
  isAllowedAuthProvider,
  isSafeAppPath,
  resolveLoginPath,
  resolveOAuthCompletePath,
} from "@/lib/auth-providers";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SUPABASE_AUTH_MS = 8_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Console OAuth PKCE callback. Parallel exchange + chrome;
 * uses admin_login_default_next from DB.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = (url.searchParams.get("next") || "").trim();
  const oauthError = (url.searchParams.get("error") || "").trim();

  const pendingCookies: PendingCookie[] = [];
  const withCookies = (res: NextResponse) => {
    for (const { name, value, options } of pendingCookies) {
      res.cookies.set(name, value, options);
    }
    return res;
  };

  let loginPath = envPathLogin();
  let allow: AllowedAuthProvidersResult = { ok: false, providers: [], chrome: null };
  const allowPromise = fetchAllowedAuthProviders(process.env.NEXT_PUBLIC_REST_URL);

  const redirectLogin = (errorCode: string) => {
    if (!loginPath || !isSafeAppPath(loginPath)) {
      return NextResponse.json({ error: "login_path_missing", detail: errorCode }, { status: 500 });
    }
    return withCookies(
      NextResponse.redirect(new URL(`${loginPath}?error=${errorCode}`, url.origin)),
    );
  };

  const applyAllow = (a: AllowedAuthProvidersResult) => {
    allow = a;
    const fromDb = resolveLoginPath(a.chrome);
    if (fromDb) loginPath = fromDb;
    return a;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    applyAllow(await allowPromise);
    return redirectLogin("missing_supabase_env");
  }
  if (oauthError && !code) {
    applyAllow(await allowPromise);
    return redirectLogin("oauth_exchange_failed");
  }
  if (!code) {
    applyAllow(await allowPromise);
    return redirectLogin("oauth_exchange_failed");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {
        for (const { name, value, options } of cookiesToSet) {
          pendingCookies.push({ name, value, options });
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Attach via withCookies on redirect.
          }
        }
      },
    },
  });

  let exchanged: Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>;
  try {
    exchanged = await withTimeout(supabase.auth.exchangeCodeForSession(code), SUPABASE_AUTH_MS);
  } catch {
    applyAllow(await allowPromise);
    return redirectLogin("oauth_exchange_failed");
  }
  applyAllow(await allowPromise);

  const { data, error } = exchanged;
  if (error) {
    return redirectLogin("oauth_exchange_failed");
  }

  const email = (data.session?.user?.email || "").trim();
  if (!email) {
    try {
      await withTimeout(supabase.auth.signOut(), 2500);
    } catch {
      /* ignore */
    }
    return redirectLogin("oauth_email_missing");
  }

  // Denylist applies to brand-new OAuth users only.
  const createdAt = Date.parse(data.session?.user?.created_at || "");
  const isBrandNew = !Number.isFinite(createdAt) || Date.now() - createdAt < 120_000;
  if (isBrandNew) {
    const restBase = (process.env.NEXT_PUBLIC_REST_URL || "").replace(/\/$/, "");
    if (!restBase) {
      try {
        await withTimeout(supabase.auth.signOut(), 2500);
      } catch {
        /* ignore */
      }
      return redirectLogin("auth_providers_unavailable");
    }
    try {
      const policyRes = await fetch(
        `${restBase}/public/email-policy?email=${encodeURIComponent(email)}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!policyRes.ok) {
        try {
          await withTimeout(supabase.auth.signOut(), 2500);
        } catch {
          /* ignore */
        }
        return redirectLogin("auth_providers_unavailable");
      }
      const policy = (await policyRes.json()) as { allowed?: boolean };
      if (policy.allowed !== true) {
        try {
          await withTimeout(supabase.auth.signOut(), 2500);
        } catch {
          /* ignore */
        }
        return redirectLogin("oauth_email_denied");
      }
    } catch {
      try {
        await withTimeout(supabase.auth.signOut(), 2500);
      } catch {
        /* ignore */
      }
      return redirectLogin("auth_providers_unavailable");
    }
  }

  const identities = data.session?.user?.identities ?? [];
  const metaProviders = data.session?.user?.app_metadata?.providers;
  const identityProviders = identities
    .map((identity) => String(identity.provider || "").toLowerCase())
    .filter(Boolean);
  const provider =
    data.session?.user?.app_metadata?.provider ??
    (Array.isArray(metaProviders) ? metaProviders[0] : undefined) ??
    identities[0]?.provider;

  if (!allow.ok) {
    try {
      await withTimeout(supabase.auth.signOut(), 2500);
    } catch {
      /* ignore */
    }
    return redirectLogin("auth_providers_unavailable");
  }

  // Primary must be allowed AND every linked identity must be allowed.
  const disallowedIdentity = identityProviders.find(
    (id) => !isAllowedAuthProvider(id, allow.providers),
  );
  if (
    !provider ||
    !isAllowedAuthProvider(String(provider), allow.providers) ||
    Boolean(disallowedIdentity)
  ) {
    try {
      await withTimeout(supabase.auth.signOut(), 2500);
    } catch {
      /* ignore */
    }
    return redirectLogin(provider ? "provider_not_allowed" : "provider_missing");
  }

  const completePath = resolveOAuthCompletePath(allow.chrome);
  if (!completePath) {
    return redirectLogin("auth_providers_unavailable");
  }

  let next = nextParam;
  if (!next || !isSafeAppPath(next)) {
    next = (allow.chrome?.admin_login_default_next || "").trim();
  }
  const callbackPath = (allow.chrome?.site?.path_auth_callback || "").trim();
  if (callbackPath && next === callbackPath) {
    next = (allow.chrome?.admin_login_default_next || "").trim();
  }
  if (!next || !isSafeAppPath(next) || next === callbackPath) {
    return redirectLogin("login_default_next_missing");
  }

  const complete = new URL(completePath, url.origin);
  complete.searchParams.set("next", next);
  return withCookies(NextResponse.redirect(complete));
}
