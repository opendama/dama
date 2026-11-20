import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { type RBACSnapshot, isRbacChromeReady } from "@/types/rbac";
import { useQuery } from "@tanstack/react-query";

export function rbacSnapshotQueryKey(token: string | null | undefined) {
  return ["console-rbac", token] as const;
}

export function useRbacSnapshotQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: rbacSnapshotQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<RBACSnapshot>("/console/rbac", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const c = data?.chrome;
      if (!isRbacChromeReady(c)) {
        const msg = (data?.chrome?.unavailable || data?.chrome?.load_failed || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
