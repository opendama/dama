import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedEvent } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export type EventSharePayload = {
  join_code: string;
  share_url: string;
  event: HostedEvent;
};

export function eventShareQueryKey(eventId: string | null | undefined) {
  return ["event-share", eventId] as const;
}

export function useEventShareQuery(eventId: string | null | undefined, enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventShareQueryKey(eventId),
    enabled: enabled && Boolean(eventId),
    queryFn: async () => {
      const { data } = await restClient.get<EventSharePayload>(`/events/${eventId}/share`);
      return data;
    },
  });
}
