import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { AdCampaign } from "@/types/ads";
import { useQuery } from "@tanstack/react-query";

export type { AdCampaign } from "@/types/ads";

export type AdCampaignsListResponse = {
  campaigns: AdCampaign[];
  meta: SkipPaginationMeta;
};

export type AdCampaignsListFilters = {
  q?: string;
  status?: string;
};

export function adCampaignsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: AdCampaignsListFilters = {},
) {
  return ["ad-campaigns", token, skip, limit, filters.q || "", filters.status || ""] as const;
}

/** `limit` must come from DB chrome `list_page_size` - never invent a default. */
export function useAdCampaignsQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  filters: AdCampaignsListFilters = {},
) {
  const hydrated = useAuthHydrated();
  const q = (filters.q || "").trim();
  const status = (filters.status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adCampaignsQueryKey(token, skip, limit, { q, status }),
    enabled: hydrated && Boolean(token) && limit > 0,
    queryFn: async () => {
      const { data } = await restClient.get<AdCampaignsListResponse>("/ads/campaigns", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          skip,
          limit,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
