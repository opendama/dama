import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { EventsListResponse } from "@/types/events";
import { useQuery } from "@tanstack/react-query";

export type OrganizerEventEntryFilter = "all" | "free" | "paid";

export function eventsListQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  entry: OrganizerEventEntryFilter,
  q: string,
  status: string,
) {
  return ["events-list", token, skip, limit, entry, q, status] as const;
}

/** `limit` must come from DB chrome `list_page_size` - never invent a default. */
export function useEventsListQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  entry: OrganizerEventEntryFilter = "all",
  q = "",
  status = "",
) {
  const hydrated = useAuthHydrated();
  const qTrim = q.trim();
  const statusTrim = status.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventsListQueryKey(token, skip, limit, entry, qTrim, statusTrim),
    enabled: hydrated && Boolean(token) && limit > 0,
    queryFn: async () => {
      const params: Record<string, string | number> = { skip, limit };
      if (entry === "free") params.is_free_entry = "true";
      if (entry === "paid") params.is_free_entry = "false";
      if (qTrim) params.q = qTrim;
      if (statusTrim) params.status = statusTrim;
      const { data } = await restClient.get<EventsListResponse>("/events/", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
