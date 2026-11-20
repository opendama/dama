import { restClient } from "@/lib/api";
import { softCommunityChromeUnavailable } from "@/lib/community-player-chrome-soft";
import { QueryStale } from "@/lib/query-policy";
import { type EventsPlayerChrome, isEventsPlayerChromeReady } from "@/types/events-player-chrome";
import { useQuery } from "@tanstack/react-query";

export function eventsPlayerChromeQueryKey() {
  return ["events-player-chrome"] as const;
}

export function useEventsPlayerChromeQuery(enabled = true) {
  return useQuery({
    queryKey: eventsPlayerChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<EventsPlayerChrome> => {
      const { data } = await restClient.get<EventsPlayerChrome>("/public/events-player-chrome");
      if (!isEventsPlayerChromeReady(data)) {
        const msg = softCommunityChromeUnavailable(
          (data?.events_player_chrome_unavailable || "").trim(),
        );
        throw new Error(msg);
      }
      return data;
    },
  });
}
