import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ProgressionConfig } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";

export const progressionQueryKey = ["progression"] as const;

export function useProgressionQuery() {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: progressionQueryKey,
    queryFn: async (): Promise<ProgressionConfig> => {
      const { data } = await restClient.get<ProgressionConfig>("/progression");
      return data;
    },
  });
}
