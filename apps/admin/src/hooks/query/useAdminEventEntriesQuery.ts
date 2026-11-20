import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { requireApiSkipMeta } from "@/lib/skip-pagination";
import { useAuthHydrated } from "@/store/auth";
import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { useQuery } from "@tanstack/react-query";

export type AdminHostedEventEntry = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  status_label?: string;
  username?: string;
  rating?: number;
  placement?: number | null;
  checked_in_at?: string | null;
  fee_paid?: number;
  fee_currency?: string;
  joined_at?: string;
};

export type AdminEventEntriesResponse = {
  entries: AdminHostedEventEntry[];
  meta: SkipPaginationMeta;
};

export function adminEventEntriesQueryKey(
  token: string | null | undefined,
  eventId: string,
  skip: number,
  limit: number,
) {
  return ["admin-event-entries", token, eventId, skip, limit] as const;
}

export function useAdminEventEntriesQuery(
  token: string | null | undefined,
  eventId: string,
  skip: number,
  limit: number,
  enabled: boolean,
) {
  const hydrated = useAuthHydrated();
  const id = (eventId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminEventEntriesQueryKey(token, id, skip, limit),
    enabled: hydrated && Boolean(token) && enabled && Boolean(id) && limit > 0 && skip >= 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<AdminEventEntriesResponse> => {
      if (!token || !id) throw new Error("");
      const { data } = await restClient.get<AdminEventEntriesResponse>(
        `/console/events/${encodeURIComponent(id)}/entries`,
        {
          headers: authHeaders(token),
          params: { skip, limit },
        },
      );
      requireApiSkipMeta(data?.meta, "admin event entries meta");
      if (!Array.isArray(data.entries)) {
        throw new Error("admin event entries unavailable");
      }
      return { entries: data.entries, meta: data.meta };
    },
  });
}
