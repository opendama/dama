import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedEvent } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventQueryKey(id: string | null | undefined) {
  return ["event", id] as const;
}

export function useEventQuery(id: string | null | undefined, enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventQueryKey(id),
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const { data } = await restClient.get<HostedEvent>(`/events/${id}`);
      return data;
    },
  });
}
