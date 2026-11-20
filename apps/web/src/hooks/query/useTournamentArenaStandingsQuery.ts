import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { ArenaStandingRow } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export function tournamentArenaStandingsQueryKey(tournamentId: string | null | undefined) {
  return ["tournament-arena-standings", tournamentId] as const;
}

export type TournamentArenaStandingsPayload = {
  standings: ArenaStandingRow[];
};

export function useTournamentArenaStandingsQuery(
  token: string | null | undefined,
  tournamentId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentArenaStandingsQueryKey(id),
    enabled: enabled && Boolean(id) && Boolean(token),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async (): Promise<TournamentArenaStandingsPayload> => {
      const { data } = await restClient.get<TournamentArenaStandingsPayload>(
        `/tournaments/${encodeURIComponent(id)}/arena/standings`,
        { headers: authHeaders(token) },
      );
      return { standings: data.standings ?? [] };
    },
  });
}
