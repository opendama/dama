import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type ClientNavPayload, isPlayerDashboardChromeReady } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export function clientNavFullQueryKey() {
  return ["client-nav-full"] as const;
}

export function useClientNavFullQuery(enabled = true) {
  return useQuery({
    queryKey: clientNavFullQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<ClientNavPayload> => {
      const { data } = await restClient.get<ClientNavPayload>("/platform/client-nav");
      if (!isPlayerDashboardChromeReady(data)) {
        throw new Error((data?.dashboard_unavailable || "").trim());
      }
      return data;
    },
  });
}
