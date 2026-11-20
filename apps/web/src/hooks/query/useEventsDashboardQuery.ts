import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { EventsDashboard } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventsDashboardQueryKey(token: string | null | undefined) {
  return ["events-dashboard", token] as const;
}

export function useEventsDashboardQuery(token: string | null | undefined) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventsDashboardQueryKey(token),
    enabled: hydrated && Boolean(token),
    queryFn: async () => {
      const { data } = await restClient.get<EventsDashboard>("/events/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
