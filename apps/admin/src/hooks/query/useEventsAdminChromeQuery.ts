import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type EventsAdminChrome, isEventsAdminChromeReady } from "@/types/events-admin-chrome";
import { useQuery } from "@tanstack/react-query";

export function eventsAdminChromeQueryKey() {
  return ["events-admin-chrome"] as const;
}

export function useEventsAdminChromeQuery(enabled = true) {
  return useQuery({
    queryKey: eventsAdminChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<Required<EventsAdminChrome>> => {
      const { data } = await restClient.get<EventsAdminChrome>("/public/events-admin-chrome");
      if (!isEventsAdminChromeReady(data)) {
        const msg = (data?.events_admin_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
