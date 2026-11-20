"use client";

import { useOptionalSignInModal } from "@/components/auth/SignInModal";
import { AuthLoginSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { isSafeAppPath, resolveLoginPath } from "@/lib/auth-providers";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Legacy /auth/login deep link + OAuth error landing.
 * Opens the global shadcn sign-in modal on the home shell (no full-page form).
 */
export default function LoginPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const providersQuery = useAuthProvidersQuery();
  const modal = useOptionalSignInModal();
  const toasted = useRef<string | null>(null);
  const opened = useRef(false);
  const [errorParam, setErrorParam] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setErrorParam(params.get("error"));
  }, []);

  useEffect(() => {
    if (!hydrated || !providersQuery.data) return;

    if (token) {
      const next = (providersQuery.data.login_default_next || "").trim();
      if (next && isSafeAppPath(next)) router.replace(next);
      return;
    }

    if (errorParam) {
      if (toasted.current !== errorParam) {
        toasted.current = errorParam;
        const chrome = providersQuery.data;
        const msg =
          errorParam === "missing_supabase_env"
            ? chrome.login_missing_supabase_env
            : errorParam === "oauth_exchange_failed"
              ? chrome.login_oauth_exchange_failed
              : errorParam === "oauth_email_missing"
                ? chrome.login_oauth_email_missing
                : errorParam === "oauth_email_denied"
                  ? chrome.login_oauth_email_denied
                  : errorParam === "provider_not_allowed" || errorParam === "provider_missing"
                    ? chrome.login_provider_disabled_message
                    : errorParam === "auth_providers_unavailable"
                      ? chrome.login_auth_providers_unavailable
                      : errorParam === "login_default_next_missing"
                        ? chrome.login_default_next_missing
                        : chrome.login_failed_message;
        if (msg) toast.error(msg);
      }
    }

    const home = (providersQuery.data.login_default_next || "/").trim();
    const dest = home && isSafeAppPath(home) ? home : "/";
    if (!opened.current) {
      opened.current = true;
      // Return to home after OAuth - never force the portal.
      modal?.openSignIn({ nextPath: dest === "/dashboard" ? "/" : dest });
    }
    const loginPath = resolveLoginPath(providersQuery.data) || "/auth/login";
    if (window.location.pathname === loginPath || window.location.pathname === "/auth/login") {
      router.replace(dest);
    }
  }, [hydrated, token, providersQuery.data, errorParam, router, modal]);

  return <AuthLoginSkeleton />;
}
