import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { EventsCatalog } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventsCatalogQueryKey() {
  return ["events-catalog"] as const;
}

export function useEventsCatalogQuery(enabled = true) {
  return useQuery({
    queryKey: eventsCatalogQueryKey(),
    enabled,
    staleTime: QueryStale.session,
    // Guests have no feature_flags WS - pick up public_events_enabled for Community/Host Public.
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await restClient.get<EventsCatalog>("/events/catalog");
      return data;
    },
  });
}
