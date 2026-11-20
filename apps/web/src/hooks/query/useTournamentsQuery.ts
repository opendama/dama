import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { CupLifecycleListFilter } from "@/lib/cupLifecycle";
import type { Tournament } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export type TournamentEntryFilter = "all" | "free" | "paid";

export type TournamentsListResponse = {
  tournaments: Tournament[];
  meta: SkipPaginationMeta;
};

export function tournamentsQueryKey(
  skip: number,
  limit: number,
  entry: TournamentEntryFilter,
  q: string,
  lifecycle: CupLifecycleListFilter,
  mine: boolean,
  token?: string | null,
) {
  return [
    "tournaments",
    skip,
    limit,
    entry,
    q,
    lifecycle,
    mine ? "mine" : "all",
    token ? "auth" : "anon",
  ] as const;
}

/** `limit` must come from DB tournaments_player_chrome.list_page_size (never invent). */
export function useTournamentsQuery(
  skip: number,
  limit: number,
  enabled = true,
  entry: TournamentEntryFilter = "all",
  q = "",
  token?: string | null,
  lifecycle: CupLifecycleListFilter = "open",
  mine = false,
) {
  const qTrim = q.trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentsQueryKey(skip, limit, entry, qTrim, lifecycle, mine, token),
    enabled: enabled && limit > 0 && (!mine || Boolean(token)),
    queryFn: async () => {
      const params: Record<string, string | number> = {
        skip,
        limit,
        lifecycle,
      };
      if (entry === "free") params.is_free = "true";
      if (entry === "paid") params.is_free = "false";
      if (qTrim) params.q = qTrim;
      if (mine) params.mine = "1";
      const { data } = await restClient.get<TournamentsListResponse>("/tournaments/", {
        params,
        headers: authHeaders(token),
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}
