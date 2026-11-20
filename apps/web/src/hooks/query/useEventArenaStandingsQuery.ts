import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ArenaStandingRow } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export function eventArenaStandingsQueryKey(eventId: string | null | undefined) {
  return ["event-arena-standings", eventId] as const;
}

export type EventArenaStandingsPayload = {
  standings: ArenaStandingRow[];
};

export function useEventArenaStandingsQuery(
  token: string | null | undefined,
  eventId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  const id = (eventId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventArenaStandingsQueryKey(id),
    enabled: enabled && Boolean(id) && Boolean(token),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async (): Promise<EventArenaStandingsPayload> => {
      const { data } = await restClient.get<EventArenaStandingsPayload>(
        `/events/${encodeURIComponent(id)}/arena/standings`,
        { headers: authHeaders(token) },
      );
      return { standings: data.standings ?? [] };
    },
  });
}
