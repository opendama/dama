import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { EventsListResponse } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function joinedEventsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
) {
  return ["events-joined", token, skip, limit] as const;
}

/** Events the signed-in player has joined (`GET /events/joined`). */
export function useJoinedEventsQuery(
  token: string | null | undefined,
  limit: number,
  enabled = true,
) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: joinedEventsQueryKey(token, 0, limit),
    enabled: Boolean(token) && enabled && limit > 0,
    queryFn: async () => {
      const { data } = await restClient.get<EventsListResponse>("/events/joined", {
        headers: authHeaders(token),
        params: { skip: 0, limit },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
