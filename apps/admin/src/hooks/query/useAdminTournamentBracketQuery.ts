import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { TournamentBracketMatch } from "@/types/tournament-bracket";
import { useQuery } from "@tanstack/react-query";

export function adminTournamentBracketQueryKey(tournamentId: string | null | undefined) {
  return ["admin-tournament-bracket", tournamentId] as const;
}

export function useAdminTournamentBracketQuery(
  token: string | null | undefined,
  tournamentId: string | null | undefined,
  enabled = true,
) {
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminTournamentBracketQueryKey(id),
    enabled: enabled && Boolean(token) && Boolean(id),
    queryFn: async () => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<{ bracket: TournamentBracketMatch[] }>(
        `/tournaments/${encodeURIComponent(id)}/bracket`,
        { headers: authHeaders(token) },
      );
      return data.bracket ?? [];
    },
  });
}
