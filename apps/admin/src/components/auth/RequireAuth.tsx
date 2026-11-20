"use client";

import { AuthLoginSkeleton } from "@/components/ui/shimmer-skeletons";
import { useAuthProvidersQuery } from "@/hooks/query/useAuthProvidersQuery";
import { envPathLogin } from "@/lib/app-paths";
import { resolveLoginPath } from "@/lib/auth-providers";
import { useAuthHydrated, useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

/**
 * Fail-closed console gate: after persist hydrate, no JWT → login only.
 * Never renders protected chrome for guests.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const providersQuery = useAuthProvidersQuery();

  const loginPath = useMemo(() => {
    const fromApi = resolveLoginPath(providersQuery.data);
    if (fromApi) return fromApi;
    return envPathLogin();
  }, [providersQuery.data]);

  useEffect(() => {
    if (!hydrated) return;
    if (token) return;
    if (!loginPath) return;
    router.replace(loginPath);
  }, [hydrated, token, loginPath, router]);

  if (!hydrated || providersQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4">
        <AuthLoginSkeleton />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4">
        <AuthLoginSkeleton />
      </div>
    );
  }

  return <>{children}</>;
}
