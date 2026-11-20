import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { EventReportsListResponse } from "@/types/event-reports";
import { useQuery } from "@tanstack/react-query";

export function eventReportsQueryKey(
  token: string | null | undefined,
  status: string,
  skip: number,
  limit: number,
) {
  return ["console-event-reports", token, status, skip, limit] as const;
}

/** `limit` must come from DB events_admin_chrome.list_page_size. */
export function useEventReportsQuery(
  token: string | null | undefined,
  enabled: boolean,
  status = "",
  skip = 0,
  limit = 0,
) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventReportsQueryKey(token, status, skip, limit),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<EventReportsListResponse> => {
      const { data } = await restClient.get<EventReportsListResponse>("/console/events/reports", {
        params: { status: status || undefined, skip, limit },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        reports: data?.reports ?? [],
        meta: data?.meta,
      };
    },
    placeholderData: (prev) => prev,
  });
}
