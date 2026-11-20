import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type PlayRailChrome, isPlayRailChromeReady } from "@/types/play-rail-chrome";
import { useQuery } from "@tanstack/react-query";

export function usePlayRailChromeQuery(enabled = true) {
  return useQuery({
    queryKey: ["chrome", "play-rail"] as const,
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async () => {
      const { data } = await restClient.get<PlayRailChrome>("/public/play-rail-chrome");
      return data;
    },
  });
}

export { isPlayRailChromeReady };
export type { PlayRailChrome };
