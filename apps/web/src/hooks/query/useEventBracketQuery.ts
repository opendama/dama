import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedBracketMatch } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventBracketQueryKey(eventId: string | null | undefined) {
  return ["event-bracket", eventId] as const;
}

export function useEventBracketQuery(
  eventId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventBracketQueryKey(eventId),
    enabled: enabled && Boolean(eventId),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async () => {
      const { data } = await restClient.get<{ bracket: HostedBracketMatch[] }>(
        `/events/${eventId}/bracket`,
      );
      return data.bracket ?? [];
    },
  });
}
