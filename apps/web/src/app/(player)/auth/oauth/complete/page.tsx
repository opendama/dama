"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { ShimmerBlock } from "@/components/ui/shimmer-skeletons";
import { useOAuthExchangeMutation } from "@/hooks/mutation/useOAuthExchangeMutation";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useClientEnumsQuery } from "@/hooks/query/useClientEnumsQuery";
import { useClientNavQuery } from "@/hooks/query/useClientNavQuery";
import {
  isSafeAppPath,
  resolveLoginPath,
  sanitizeCasualLoginDefault,
  sanitizeLoginNext,
} from "@/lib/auth-providers";
import { claimWebOAuthExchange } from "@/lib/oauth-exchange-latch";
import { isConsoleRole, isPublisherRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

/** After Supabase PKCE callback: mint dama JWT. Destinations from DB chrome/nav only. */
function OAuthCompleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const setOAuthProfile = useAuthStore((s) => s.setOAuthProfile);
  const exchange = useOAuthExchangeMutation();
  const enumsQuery = useClientEnumsQuery();
  const providersQuery = useAuthProvidersQuery();
  const adsNavQuery = useClientNavQuery("ads");
  const signInModal = useOptionalSignInModal();
  const [error, setError] = useState<string | null>(null);

  // Never show the sign-in modal on this intermediate route.
  useEffect(() => {
    signInModal?.closeSignIn();
  }, [signInModal]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: module latch; omit unstable exchange identity
  useEffect(() => {
    if (providersQuery.isLoading || enumsQuery.isLoading || adsNavQuery.isLoading) return;
    if (!claimWebOAuthExchange()) return;

    void (async () => {
      const loginPath = resolveLoginPath(providersQuery.data);
      const failRedirect = (errorCode = "oauth_exchange_failed") => {
        if (loginPath) {
          router.replace(`${loginPath}?error=${encodeURIComponent(errorCode)}`);
        }
      };
      try {
        if (!providersQuery.data) {
          throw new Error("");
        }
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
          throw new Error(providersQuery.data.login_oauth_exchange_failed || "");
        }
        const result = await exchange.mutateAsync(accessToken);
        const roleCatalog = enumsQuery.data;
        if (!roleCatalog) {
          throw new Error(providersQuery.data.login_failed_message || "");
        }
        if (isConsoleRole(result.user.role, roleCatalog)) {
          throw new Error(providersQuery.data.login_failed_message || "");
        }
        setSession(result.accessToken, result.user);
        const okMsg = (providersQuery.data.login_success_message || "").trim();
        if (okMsg) toast.success(okMsg);

        const nextRaw = (params.get("next") || "").trim();
        let next = isSafeAppPath(nextRaw) ? nextRaw : "";
        if (!next) {
          if (isPublisherRole(result.user.role, roleCatalog)) {
            const adsHome =
              (adsNavQuery.data ?? []).find((l) => l.route_key === "ads_dashboard")?.href ||
              (adsNavQuery.data ?? [])[0]?.href ||
              "";
            next = sanitizeLoginNext(adsHome, "/");
          } else {
            next = sanitizeCasualLoginDefault(providersQuery.data.login_default_next, "/");
          }
        } else {
          next = sanitizeLoginNext(next, "/");
        }
        router.replace(next);
      } catch (e) {
        const msg = (providersQuery.data?.login_failed_message || "").trim();
        setError(msg);
        if (msg) toast.error(msg);
        const detail = e instanceof Error ? e.message : "";
        try {
          await createClient().auth.signOut();
        } catch {
          /* ignore */
        }
        const lower = detail.toLowerCase();
        const errorCode =
          lower.includes("supabase auth unavailable") || lower.includes("jwt secret")
            ? "auth_providers_unavailable"
            : lower.includes("provider not allowed")
              ? "provider_not_allowed"
              : lower.includes("oauth_email_denied") || lower.includes("email")
                ? "oauth_email_denied"
                : "oauth_exchange_failed";
        failRedirect(errorCode);
      }
    })();
  }, [
    adsNavQuery.data,
    adsNavQuery.isLoading,
    enumsQuery.data,
    enumsQuery.isLoading,
    params,
    providersQuery.data,
    providersQuery.isLoading,
    router,
    setOAuthProfile,
    setSession,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-8 text-center">
      {error ? (
        <p className="text-sm text-[var(--dama-danger)]">{error}</p>
      ) : (
        <>
          <ShimmerBlock className="h-10 w-10 rounded-full" />
          <ShimmerBlock className="h-4 w-40 rounded-md" />
          <ShimmerBlock className="h-3 w-56 rounded-md" />
        </>
      )}
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-8">
          <ShimmerBlock className="h-10 w-10 rounded-full" />
          <ShimmerBlock className="h-4 w-40 rounded-md" />
        </div>
      }
    >
      <OAuthCompleteContent />
    </Suspense>
  );
}
