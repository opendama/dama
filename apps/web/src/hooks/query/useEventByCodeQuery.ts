import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { HostedEvent } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export function eventByCodeQueryKey(code: string | null | undefined) {
  return ["event-by-code", (code || "").trim().toUpperCase()] as const;
}

export function useEventByCodeQuery(code: string | null | undefined, enabled = true) {
  const normalized = (code || "").trim().toUpperCase();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventByCodeQueryKey(normalized),
    enabled: enabled && Boolean(normalized),
    queryFn: async () => {
      const { data } = await restClient.get<HostedEvent>(
        `/events/by-code/${encodeURIComponent(normalized)}`,
      );
      return data;
    },
  });
}
