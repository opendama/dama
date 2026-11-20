import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type TournamentChrome, isTournamentChromeReady } from "@/types/tournament-chrome";
import { useQuery } from "@tanstack/react-query";

export function tournamentChromeQueryKey() {
  // v6: official pause/resume control-room keys (migration 496).
  return ["tournament-chrome", "v6"] as const;
}

export function useTournamentChromeQuery(enabled = true) {
  return useQuery({
    queryKey: tournamentChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<TournamentChrome> => {
      const { data } = await restClient.get<TournamentChrome>("/public/tournament-chrome");
      if (!isTournamentChromeReady(data)) {
        const msg = (data?.tournament_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
