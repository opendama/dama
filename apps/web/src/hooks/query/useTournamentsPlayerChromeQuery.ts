import { restClient } from "@/lib/api";
import { softCommunityChromeUnavailable } from "@/lib/community-player-chrome-soft";
import { QueryStale } from "@/lib/query-policy";
import {
  type TournamentsPlayerChrome,
  isTournamentsPlayerChromeReady,
} from "@/types/tournaments-player-chrome";
import { useQuery } from "@tanstack/react-query";

export function tournamentsPlayerChromeQueryKey() {
  return ["tournaments-player-chrome"] as const;
}

export function useTournamentsPlayerChromeQuery(enabled = true) {
  return useQuery({
    queryKey: tournamentsPlayerChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<TournamentsPlayerChrome> => {
      const { data } = await restClient.get<TournamentsPlayerChrome>(
        "/public/tournaments-player-chrome",
      );
      if (!isTournamentsPlayerChromeReady(data)) {
        const msg = softCommunityChromeUnavailable(
          (data?.tournaments_player_chrome_unavailable || "").trim(),
        );
        throw new Error(msg);
      }
      return data;
    },
  });
}
