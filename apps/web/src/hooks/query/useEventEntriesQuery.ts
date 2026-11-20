import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { HostedEventEntry } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventEntriesQueryKey(
  token: string | null | undefined,
  eventId: string | null | undefined,
) {
  return ["event-entries", token ?? "", eventId] as const;
}

/**
 * Approved roster for player detail (public cups allow guest GET /events/{id}/entries).
 * Authorization header only when signed in.
 */
export function useEventEntriesQuery(
  token: string | null | undefined,
  eventId: string | null | undefined,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  const auth = (token || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventEntriesQueryKey(auth || null, eventId),
    enabled: hydrated && enabled && Boolean(eventId),
    queryFn: async () => {
      const { data } = await restClient.get<{ entries: HostedEventEntry[] }>(
        `/events/${eventId}/entries`,
        auth ? { headers: { Authorization: `Bearer ${auth}` } } : undefined,
      );
      return data.entries ?? [];
    },
  });
}
