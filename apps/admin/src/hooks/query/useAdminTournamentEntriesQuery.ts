import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { requireApiSkipMeta } from "@/lib/skip-pagination";
import { useAuthHydrated } from "@/store/auth";
import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { useQuery } from "@tanstack/react-query";

export type AdminTournamentEntry = {
  user_id: string;
  username?: string;
  status?: string;
  checked_in_at?: string | null;
  joined_at?: string;
  placement?: number | null;
};

export type AdminTournamentEntriesResponse = {
  entries: AdminTournamentEntry[];
  meta: SkipPaginationMeta;
};

export function adminTournamentEntriesQueryKey(
  token: string | null | undefined,
  tournamentId: string,
  skip: number,
  limit: number,
) {
  return ["admin-tournament-entries", token, tournamentId, skip, limit] as const;
}

export function useAdminTournamentEntriesQuery(
  token: string | null | undefined,
  tournamentId: string,
  skip: number,
  limit: number,
  enabled: boolean,
) {
  const hydrated = useAuthHydrated();
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminTournamentEntriesQueryKey(token, id, skip, limit),
    enabled: hydrated && Boolean(token) && enabled && Boolean(id) && limit > 0 && skip >= 0,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<AdminTournamentEntriesResponse> => {
      if (!token || !id) throw new Error("");
      const { data } = await restClient.get<AdminTournamentEntriesResponse>(
        `/console/tournaments/${encodeURIComponent(id)}/entries`,
        {
          headers: authHeaders(token),
          params: { skip, limit },
        },
      );
      requireApiSkipMeta(data?.meta, "admin tournament entries meta");
      if (!Array.isArray(data.entries)) {
        throw new Error("admin tournament entries unavailable");
      }
      return { entries: data.entries, meta: data.meta };
    },
  });
}
