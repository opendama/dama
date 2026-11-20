"use client";

import { AuthLoginSkeleton, DashboardCardsSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { useConsoleNavQuery } from "@/hooks/query/useConsoleNavQuery";
import { envPathLogin } from "@/lib/app-paths";
import { resolveLoginPath } from "@/lib/auth-providers";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

/** Root: guests → login; signed-in → first console_nav href (DB-driven). */
export default function AdminHomePage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const providersQuery = useAuthProvidersQuery();
  const navQuery = useConsoleNavQuery(Boolean(token));

  const loginPath = useMemo(() => {
    const fromApi = resolveLoginPath(providersQuery.data);
    if (fromApi) return fromApi;
    return envPathLogin();
  }, [providersQuery.data]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      if (loginPath) router.replace(loginPath);
      return;
    }
    if (navQuery.isLoading || navQuery.isFetching) return;
    const href = (navQuery.data?.modules?.[0]?.href || "").trim();
    if (href.startsWith("/") && !href.startsWith("//")) {
      router.replace(href);
    }
  }, [hydrated, token, loginPath, navQuery.data, navQuery.isLoading, navQuery.isFetching, router]);

  if (!hydrated || !token) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4">
        <AuthLoginSkeleton />
      </div>
    );
  }

  if (navQuery.isLoading || navQuery.isFetching) {
    return (
      <div className="p-6">
        <DashboardCardsSkeleton />
      </div>
    );
  }

  if (navQuery.isError || !(navQuery.data?.modules?.[0]?.href || "").trim()) {
    const msg = (navQuery.data?.graphql_empty || "").trim();
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        {msg ? (
          <p className="text-sm text-[var(--dama-danger)]" role="alert">
            {msg}
          </p>
        ) : (
          <p className="text-sm text-[var(--dama-danger)]">{"\u00a0"}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <DashboardCardsSkeleton />
    </div>
  );
}
