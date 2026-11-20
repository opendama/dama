import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type LeaderboardChrome, isLeaderboardChromeReady } from "@/types/leaderboard-chrome";
import { useQuery } from "@tanstack/react-query";

export function leaderboardChromeQueryKey() {
  return ["leaderboard-chrome"] as const;
}

export function useLeaderboardChromeQuery(enabled = true) {
  return useQuery({
    queryKey: leaderboardChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<LeaderboardChrome> => {
      const { data } = await restClient.get<LeaderboardChrome>("/public/leaderboard-chrome");
      if (!isLeaderboardChromeReady(data)) {
        const msg = (data?.leaderboard_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
