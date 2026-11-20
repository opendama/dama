import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdCampaignAnalyticsRow } from "@/types/ads";
import { useQuery } from "@tanstack/react-query";

export function adAnalyticsQueryKey(token: string | null | undefined, pageSize: number) {
  return ["ad-analytics", token, pageSize] as const;
}

type CampaignsPage = {
  campaigns: AdCampaignAnalyticsRow[];
  meta?: SkipPaginationMeta;
};

/**
 * Aggregates all publisher campaigns for analytics KPIs.
 * `pageSize` must come from DB chrome `list_page_size` - never invent.
 */
export function useAdAnalyticsQuery(token: string | null | undefined, pageSize: number) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adAnalyticsQueryKey(token, pageSize),
    enabled: hydrated && Boolean(token) && pageSize > 0,
    queryFn: async () => {
      const all: AdCampaignAnalyticsRow[] = [];
      let skip = 0;
      for (;;) {
        const { data } = await restClient.get<CampaignsPage>("/ads/campaigns", {
          headers: { Authorization: `Bearer ${token}` },
          params: { skip, limit: pageSize },
        });
        all.push(...(data.campaigns ?? []));
        const next = data.meta?.next_skip;
        if (!data.meta?.has_more || next == null) break;
        skip = next;
      }
      return all;
    },
  });
}
