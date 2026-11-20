import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { requireApiSkipMeta } from "@/lib/skip-pagination";
import { useAuthHydrated } from "@/store/auth";
import type { HostedEventEntry } from "@/types/events";
import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { useQuery } from "@tanstack/react-query";

export type EventEntriesPagedResponse = {
  entries: HostedEventEntry[];
  meta: SkipPaginationMeta;
  entry_fees_gross: number;
  entry_fees_commission: number;
  entry_fees_organizer_net: number;
  entry_fees_paid_count: number;
  entry_fees_currency: string;
};

export function eventEntriesPagedQueryKey(
  token: string | null | undefined,
  eventId: string | null | undefined,
  skip: number,
  limit: number,
) {
  return ["event-entries-paged", token ?? "", eventId, skip, limit] as const;
}

/** Organizer Manage Players/Payments roster page - requires real skip/limit (DB chrome page size). */
export function useEventEntriesPagedQuery(
  token: string | null | undefined,
  eventId: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
) {
  const hydrated = useAuthHydrated();
  const auth = (token || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: eventEntriesPagedQueryKey(auth || null, eventId, skip, limit),
    enabled: hydrated && enabled && Boolean(eventId) && Boolean(auth) && limit > 0 && skip >= 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<EventEntriesPagedResponse> => {
      const { data } = await restClient.get<EventEntriesPagedResponse>(
        `/events/${eventId}/entries`,
        {
          headers: { Authorization: `Bearer ${auth}` },
          params: { skip, limit },
        },
      );
      requireApiSkipMeta(data?.meta, "event entries meta");
      if (!Array.isArray(data.entries)) {
        throw new Error("event entries unavailable");
      }
      if (
        typeof data.entry_fees_gross !== "number" ||
        typeof data.entry_fees_commission !== "number" ||
        typeof data.entry_fees_organizer_net !== "number" ||
        typeof data.entry_fees_paid_count !== "number" ||
        typeof data.entry_fees_currency !== "string"
      ) {
        throw new Error("event entry fee totals unavailable");
      }
      return {
        entries: data.entries,
        meta: data.meta,
        entry_fees_gross: data.entry_fees_gross,
        entry_fees_commission: data.entry_fees_commission,
        entry_fees_organizer_net: data.entry_fees_organizer_net,
        entry_fees_paid_count: data.entry_fees_paid_count,
        entry_fees_currency: data.entry_fees_currency,
      };
    },
  });
}
