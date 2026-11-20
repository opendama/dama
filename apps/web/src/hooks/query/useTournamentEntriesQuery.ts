import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { TournamentRosterEntry } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export function tournamentEntriesQueryKey(tournamentId: string | null | undefined) {
  return ["tournament-entries", tournamentId] as const;
}

export function useTournamentEntriesQuery(tournamentId: string | null | undefined, enabled = true) {
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentEntriesQueryKey(id),
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const { data } = await restClient.get<{ entries: TournamentRosterEntry[] }>(
        `/tournaments/${id}/entries`,
      );
      return data.entries ?? [];
    },
  });
}
