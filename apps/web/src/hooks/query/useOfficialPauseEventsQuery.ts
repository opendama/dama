import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { OfficialPauseEvent } from "@/types/official-pause-chrome";
import { useQuery } from "@tanstack/react-query";

export function officialPauseEventsQueryKey(gameId: string) {
  return ["official-pause-events", gameId] as const;
}

export function useOfficialPauseEventsQuery(
  token: string | null | undefined,
  gameId: string | null | undefined,
  enabled = true,
) {
  const gid = (gameId || "").trim();
  return useQuery({
    queryKey: officialPauseEventsQueryKey(gid),
    enabled: Boolean(enabled && token && gid),
    staleTime: QueryStale.live,
    queryFn: async (): Promise<OfficialPauseEvent[]> => {
      if (!token || !gid) return [];
      const { data } = await restClient.get<{ events?: OfficialPauseEvent[] }>(
        `/games/${encodeURIComponent(gid)}/official-pause-events`,
        { headers: authHeaders(token) },
      );
      return Array.isArray(data?.events) ? data.events : [];
    },
  });
}
