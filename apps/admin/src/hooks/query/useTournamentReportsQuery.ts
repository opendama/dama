import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { TournamentReportsListResponse } from "@/types/tournament-reports";
import { useQuery } from "@tanstack/react-query";

export function tournamentReportsQueryKey(
  status: string,
  skip: number,
  limit: number,
): readonly [string, string, string, number, number] {
  return ["console", "tournament-reports", status, skip, limit] as const;
}

/** `limit` must come from DB tournament_chrome.list_page_size. */
export function useTournamentReportsQuery(
  token: string | null | undefined,
  enabled: boolean,
  status: string,
  skip: number,
  limit: number,
) {
  const st = (status || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentReportsQueryKey(st, skip, limit),
    enabled: Boolean(token) && enabled && limit > 0,
    queryFn: async (): Promise<TournamentReportsListResponse> => {
      const { data } = await restClient.get<TournamentReportsListResponse>(
        "/console/tournaments/reports",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { status: st || undefined, skip, limit },
        },
      );
      return {
        reports: data?.reports ?? [],
        meta: data?.meta,
      };
    },
    placeholderData: (prev) => prev,
  });
}
