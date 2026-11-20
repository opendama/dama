"use client";

import { AuthLoginSkeleton } from "@/components/ui/shimmer-skeletons";
import { useOAuthExchangeMutation } from "@/hooks/mutation/useOAuthExchangeMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useConsoleNavQuery } from "@/hooks/query/useConsoleNavQuery";
import { isSafeAppPath, resolveLoginPath } from "@/lib/auth-providers";
import { claimAdminOAuthExchange } from "@/lib/oauth-exchange-latch";
import { isConsoleRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

/** Mint dama JWT for authorized console roles only. Destinations from DB chrome/nav. */
function OAuthCompleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const setOAuthProfile = useAuthStore((s) => s.setOAuthProfile);
  const exchange = useOAuthExchangeMutation();
  const enumsQuery = useClientEnumsQuery();
  const providersQuery = useAuthProvidersQuery();
  const consoleNavQuery = useConsoleNavQuery();
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: module latch; omit unstable exchange identity
  useEffect(() => {
    if (providersQuery.isLoading || enumsQuery.isLoading) return;

    if (providersQuery.isError || enumsQuery.isError || !providersQuery.data) {
      if (!claimAdminOAuthExchange()) return;
      const msg =
        (providersQuery.data?.login_failed_message || "").trim() ||
        (providersQuery.data?.login_oauth_exchange_failed || "").trim();
      setError(msg || "\u00a0");
      if (msg) toast.error(msg);
      const loginPath = resolveLoginPath(providersQuery.data);
      if (loginPath) {
        router.replace(`${loginPath}?error=oauth_exchange_failed`);
      }
      return;
    }

    if (!enumsQuery.data?.console_roles?.length) {
      if (!claimAdminOAuthExchange()) return;
      const msg = (providersQuery.data.login_failed_message || "").trim();
      setError(msg || "\u00a0");
      if (msg) toast.error(msg);
      const loginPath = resolveLoginPath(providersQuery.data);
      if (loginPath) {
        router.replace(`${loginPath}?error=oauth_exchange_failed`);
      }
      return;
    }

    if (!claimAdminOAuthExchange()) return;

    const chrome = providersQuery.data;
    const loginPath = resolveLoginPath(chrome);
    const failRedirect = (errorCode = "oauth_exchange_failed") => {
      if (loginPath) {
        router.replace(`${loginPath}?error=${encodeURIComponent(errorCode)}`);
      }
    };

    void (async () => {
      try {
        const supabase = createClient();
        // PKCE cookies can lag one tick after the server callback redirect - retry briefly.
        let accessToken = "";
        for (let attempt = 0; attempt < 5 && !accessToken; attempt += 1) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 150 * attempt));
          }
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (!sessionError && data.session?.access_token) {
            accessToken = data.session.access_token;
            const meta = data.session.user?.user_metadata || {};
            const googleName = [meta.full_name, meta.name, meta.user_name]
              .map((v) => (typeof v === "string" ? v.trim() : ""))
              .find(Boolean);
            const googleAvatar = [meta.avatar_url, meta.picture, meta.avatar]
              .map((v) => (typeof v === "string" ? v.trim() : ""))
              .find(Boolean);
            setOAuthProfile({
              name: googleName || "",
              email: (data.session.user?.email || "").trim(),
              avatarUrl: googleAvatar || "",
            });
          }
        }
        if (!accessToken) {
          throw new Error(chrome.login_oauth_exchange_failed || "");
        }

        const result = await exchange.mutateAsync(accessToken);

        const role = (result.user?.role || "").trim();
        if (!isConsoleRole(role, enumsQuery.data)) {
          throw new Error(chrome.login_failed_message || "");
        }
        setSession(result.accessToken, result.user);
        const okMsg = (chrome.login_success_message || "").trim();
        if (okMsg) toast.success(okMsg);

        const nextRaw = (params.get("next") || "").trim();
        let next = isSafeAppPath(nextRaw) ? nextRaw : "";
        if (!next) {
          next =
            (chrome.admin_login_default_next || "").trim() ||
            (consoleNavQuery.data?.modules?.[0]?.href || "").trim();
        }
        if (!next || !isSafeAppPath(next)) {
          throw new Error(chrome.admin_login_default_next_missing || "");
        }
        // Hard navigation: persist + RequireAuth hydrate cleanly on dashboard.
        window.location.replace(next);
      } catch (e) {
        const msg = (providersQuery.data?.login_failed_message || "").trim();
        setError(msg || "\u00a0");
        if (msg) toast.error(msg);
        try {
          await createClient().auth.signOut();
        } catch {
          /* ignore */
        }
        const detail = e instanceof Error ? e.message : "";
        const lower = detail.toLowerCase();
        const errorCode =
          lower.includes("rate limit") || lower.includes("429")
            ? "oauth_exchange_failed"
            : lower.includes("supabase auth unavailable") || lower.includes("jwt secret")
              ? "auth_providers_unavailable"
              : lower.includes("provider not allowed")
                ? "provider_not_allowed"
                : "oauth_exchange_failed";
        failRedirect(errorCode);
      }
    })();
  }, [
    consoleNavQuery.data,
    enumsQuery.data,
    enumsQuery.isError,
    enumsQuery.isLoading,
    params,
    providersQuery.data,
    providersQuery.isError,
    providersQuery.isLoading,
    router,
    setOAuthProfile,
    setSession,
  ]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
      <div className="w-full space-y-4 text-center">
        <h1 className="font-display text-2xl font-bold">
          {providersQuery.data?.admin_login_title || ""}
        </h1>
        {error ? (
          <p className="text-sm text-[var(--dama-danger)]">{error}</p>
        ) : (
          <AuthLoginSkeleton />
        )}
      </div>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
          <AuthLoginSkeleton />
        </div>
      }
    >
      <OAuthCompleteContent />
    </Suspense>
  );
}
