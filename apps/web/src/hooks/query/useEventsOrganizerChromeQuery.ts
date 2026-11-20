import { restClient } from "@/lib/api";
import { softHostingChromeUnavailable } from "@/lib/hosting-organizer-chrome-soft";
import { QueryStale } from "@/lib/query-policy";
import {
  type EventsOrganizerChrome,
  isEventsOrganizerChromeReady,
} from "@/types/events-organizer-chrome";
import { useQuery } from "@tanstack/react-query";

export function eventsOrganizerChromeQueryKey() {
  // v3: official pause/resume actions (migration 496).
  return ["events-organizer-chrome", "v3"] as const;
}

export function useEventsOrganizerChromeQuery(enabled = true) {
  return useQuery({
    queryKey: eventsOrganizerChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<EventsOrganizerChrome> => {
      const { data } = await restClient.get<EventsOrganizerChrome>(
        "/public/events-organizer-chrome",
      );
      if (!isEventsOrganizerChromeReady(data)) {
        const msg = softHostingChromeUnavailable(
          (data?.events_organizer_chrome_unavailable || "").trim(),
        );
        throw new Error(msg);
      }
      return data;
    },
  });
}
