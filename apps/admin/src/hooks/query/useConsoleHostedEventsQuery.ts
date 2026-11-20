import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { HostedEventsConsoleListResponse } from "@/types/hosted-events-console";
import { useQuery } from "@tanstack/react-query";

export type ConsoleEventEntryFilter = "all" | "free" | "paid";

export function consoleHostedEventsQueryKey(
  token: string | null | undefined,
  skip: number,
  limit: number,
  entry: ConsoleEventEntryFilter,
  q: string,
) {
  return ["console-hosted-events", token, skip, limit, entry, q] as const;
}

/** `limit` must come from DB events_admin_chrome.list_page_size. */
export function useConsoleHostedEventsQuery(
  token: string | null | undefined,
  enabled: boolean,
  skip: number,
  limit: number,
  entry: ConsoleEventEntryFilter = "all",
  q = "",
) {
  const hydrated = useAuthHydrated();
  const qTrim = q.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleHostedEventsQueryKey(token, skip, limit, entry, qTrim),
    enabled: hydrated && Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<HostedEventsConsoleListResponse> => {
      const params: Record<string, string | number> = { skip, limit };
      if (entry === "free") params.is_free_entry = "true";
      if (entry === "paid") params.is_free_entry = "false";
      if (qTrim) params.q = qTrim;
      const { data } = await restClient.get<HostedEventsConsoleListResponse>("/console/events", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        events: data?.events ?? [],
        meta: data?.meta,
      };
    },
    placeholderData: (prev) => prev,
  });
}
