import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { EventsAnalytics } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventsAnalyticsQueryKey(token: string | null | undefined) {
  return ["events-analytics", token] as const;
}

export function useEventsAnalyticsQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventsAnalyticsQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async () => {
      const { data } = await restClient.get<EventsAnalytics>("/events/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
