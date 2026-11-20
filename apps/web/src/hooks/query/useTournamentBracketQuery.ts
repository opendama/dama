import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { TournamentBracketMatch } from "@/types/tournament";
import { useQuery } from "@tanstack/react-query";

export function tournamentBracketQueryKey(tournamentId: string | null | undefined) {
  return ["tournament-bracket", tournamentId] as const;
}

export function useTournamentBracketQuery(
  tournamentId: string | null | undefined,
  enabled = true,
  pollIntervalMs = 0,
) {
  const id = (tournamentId || "").trim();
  const pollMs = Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 0;
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: tournamentBracketQueryKey(id),
    enabled: enabled && Boolean(id),
    refetchInterval: pollMs > 0 ? pollMs : false,
    queryFn: async () => {
      const { data } = await restClient.get<{ bracket: TournamentBracketMatch[] }>(
        `/tournaments/${id}/bracket`,
      );
      return data.bracket ?? [];
    },
  });
}
