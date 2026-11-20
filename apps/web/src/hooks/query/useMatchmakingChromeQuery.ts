import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type MatchmakingChrome, isMatchmakingChromeReady } from "@/types/matchmaking-chrome";
import { useQuery } from "@tanstack/react-query";

export function matchmakingChromeQueryKey() {
  return ["matchmaking-chrome"] as const;
}

export function useMatchmakingChromeQuery(enabled = true) {
  return useQuery({
    queryKey: matchmakingChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<MatchmakingChrome> => {
      const { data } = await restClient.get<MatchmakingChrome>("/public/matchmaking-chrome");
      if (!isMatchmakingChromeReady(data)) {
        const msg = (data?.matchmaking_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
