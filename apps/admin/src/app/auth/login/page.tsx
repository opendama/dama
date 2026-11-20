"use client";

import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { DamaWordmark } from "@/components/brand/dama-wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AuthLoginSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { isSafeAppPath, resolveLoginPath } from "@/lib/auth-providers";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { toast } from "sonner";

/** Google-only console sign-in. Chrome from auth-providers DB only. */
function AdminLoginPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const providersQuery = useAuthProvidersQuery();
  const toasted = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !token || !providersQuery.data) return;
    const next = (providersQuery.data.admin_login_default_next || "").trim();
    if (next && isSafeAppPath(next)) {
      window.location.replace(next);
      return;
    }
    // Fail closed: never leave a signed-in user on an infinite login skeleton.
    window.location.replace("/");
  }, [hydrated, token, providersQuery.data]);

  useEffect(() => {
    const errorParam = params.get("error");
    if (!errorParam || !providersQuery.data) return;
    if (toasted.current === errorParam) return;
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
                    ? chrome.admin_login_default_next_missing
                    : chrome.login_failed_message;
    if (msg) toast.error(msg);
    const loginPath = resolveLoginPath(chrome);
    if (loginPath) router.replace(loginPath);
  }, [params, providersQuery.data, router]);

  if (!hydrated || providersQuery.isLoading || token) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
        <AuthLoginSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
      <div className="w-full space-y-6 text-center">
        <div className="relative">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <div className="mb-4 flex justify-center">
            <DamaWordmark
              size="xl"
              alt={(providersQuery.data?.admin_login_title || "").trim()}
              priority
            />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {providersQuery.data?.admin_login_title || ""}
          </h1>
          {providersQuery.data?.login_subtitle ? (
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--dama-muted)]">
              {providersQuery.data.login_subtitle}
            </p>
          ) : null}
        </div>
        <div className="space-y-4 rounded-xl border border-[var(--dama-border)] bg-[var(--dama-card)] p-5 text-left">
          <SocialSignInButtons />
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
          <AuthLoginSkeleton />
        </div>
      }
    >
      <AdminLoginPageContent />
    </Suspense>
  );
}
