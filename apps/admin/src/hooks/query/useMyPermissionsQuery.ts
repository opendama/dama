import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import { type MyPermissions, isRbacChromeReady } from "@/types/rbac";
import { useQuery } from "@tanstack/react-query";

export function myPermissionsQueryKey(token: string | null | undefined) {
  return ["console-me-permissions", token] as const;
}

export function useMyPermissionsQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: myPermissionsQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<MyPermissions>("/console/me/permissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (
        !isRbacChromeReady(data?.chrome) ||
        !data.ads_chrome?.lacks_permissions ||
        !data.ads_chrome.section_title ||
        !data.ads_chrome.runtime_permission_key ||
        !data.ads_chrome.campaigns_permission_key
      ) {
        const msg = (data?.chrome?.load_failed || data?.ads_chrome?.lacks_permissions || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
