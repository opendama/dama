import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedStandingRow } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventStandingsQueryKey(eventId: string | null | undefined) {
  return ["event-standings", eventId] as const;
}

export type EventStandingsPayload = {
  standings: HostedStandingRow[];
  format_id: string;
};

export function useEventStandingsQuery(
  eventId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventStandingsQueryKey(eventId),
    enabled: enabled && Boolean(eventId),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async (): Promise<EventStandingsPayload> => {
      const { data } = await restClient.get<EventStandingsPayload>(`/events/${eventId}/standings`);
      return {
        standings: data.standings ?? [],
        format_id: (data.format_id || "").trim(),
      };
    },
  });
}
