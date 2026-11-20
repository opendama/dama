import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { FeatureFlags } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export type { FeatureFlags } from "@/types/platform";

export const restFeatureFlagsQueryKey = ["rest-feature-flags"] as const;

export function useRestFeatureFlagsQuery() {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: restFeatureFlagsQueryKey,
    queryFn: async (): Promise<FeatureFlags> => {
      const { data } = await restClient.get<FeatureFlags>("/feature-flags");
      return data;
    },
  });
}
