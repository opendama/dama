import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { requireApiSkipMeta } from "@/lib/skip-pagination";
import { useAuthHydrated } from "@/store/auth";
import type { HostedBracketMatch } from "@/types/events";
import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { useQuery } from "@tanstack/react-query";

export type EventLiveBoardsResponse = {
  matches: HostedBracketMatch[];
  meta: SkipPaginationMeta;
  officially_paused_count: number;
};

export function eventLiveBoardsQueryKey(
  token: string | null | undefined,
  eventId: string | null | undefined,
  skip: number,
  limit: number,
  officialOnly: boolean,
) {
  return ["event-live-boards", token ?? "", eventId, skip, limit, officialOnly] as const;
}

/** Organizer Manage Live boards - skip/go page from GET /events/{id}/live-boards. */
export function useEventLiveBoardsQuery(
  token: string | null | undefined,
  eventId: string | null | undefined,
  skip: number,
  limit: number,
  officialOnly: boolean,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  const auth = (token || "").trim();
  return useQuery({
    staleTime: QueryStale.live,
    refetchInterval: enabled ? 5_000 : false,
    queryKey: eventLiveBoardsQueryKey(auth || null, eventId, skip, limit, officialOnly),
    enabled: hydrated && enabled && Boolean(eventId) && Boolean(auth) && limit > 0 && skip >= 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<EventLiveBoardsResponse> => {
      const params: Record<string, string | number> = { skip, limit };
      if (officialOnly) params.official_only = "1";
      const { data } = await restClient.get<EventLiveBoardsResponse>(
        `/events/${eventId}/live-boards`,
        { headers: authHeaders(auth), params },
      );
      requireApiSkipMeta(data?.meta, "event live boards meta");
      if (!Array.isArray(data.matches)) {
        throw new Error("event live boards unavailable");
      }
      if (typeof data.officially_paused_count !== "number") {
        throw new Error("event live boards officially_paused_count unavailable");
      }
      return {
        matches: data.matches,
        meta: data.meta,
        officially_paused_count: data.officially_paused_count,
      };
    },
  });
}
