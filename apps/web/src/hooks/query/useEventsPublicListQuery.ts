import { authHeaders, restClient } from "@/lib/api";
import type { CupLifecycleListFilter } from "@/lib/cupLifecycle";
import { QueryStale } from "@/lib/query-policy";
import type { EventsListResponse } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export type EventEntryFilter = "all" | "free" | "paid";

export function eventsPublicListQueryKey(
  skip: number,
  limit: number,
  entry: EventEntryFilter,
  q: string,
  lifecycle: CupLifecycleListFilter,
  mine: boolean,
  token?: string | null,
) {
  return [
    "events-public-list",
    skip,
    limit,
    entry,
    q,
    lifecycle,
    mine ? "mine" : "all",
    token ? "auth" : "anon",
  ] as const;
}

/** `limit` must come from DB chrome `list_page_size` - never invent a default. */
export function useEventsPublicListQuery(
  enabled: boolean,
  skip: number,
  limit: number,
  entry: EventEntryFilter = "all",
  q = "",
  lifecycle: CupLifecycleListFilter = "open",
  mine = false,
  token?: string | null,
) {
  const qTrim = q.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventsPublicListQueryKey(skip, limit, entry, qTrim, lifecycle, mine, token),
    enabled: enabled && limit > 0 && (!mine || Boolean(token)),
    queryFn: async () => {
      const params: Record<string, string | number> = { skip, limit, lifecycle };
      if (entry === "free") params.is_free_entry = "true";
      if (entry === "paid") params.is_free_entry = "false";
      if (qTrim) params.q = qTrim;
      if (mine) params.mine = "1";
      const { data } = await restClient.get<EventsListResponse>("/events/public", {
        params,
        headers: authHeaders(token),
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
