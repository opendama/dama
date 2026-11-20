import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { FeatureFlagCatalog } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export function featureFlagCatalogQueryKey() {
  return ["feature-flag-catalog"] as const;
}

export function useFeatureFlagCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: featureFlagCatalogQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<FeatureFlagCatalog>("/platform/feature-flag-catalog");
      return data;
    },
  });
}
