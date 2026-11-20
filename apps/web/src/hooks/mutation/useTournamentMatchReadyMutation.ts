import { restClient } from "@/lib/api";
import { invalidateTournamentCup } from "@/lib/invalidate";
import type { TournamentBracketMatch } from "@/types/tournament";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReadyResponse = {
  match?: TournamentBracketMatch;
  game_id?: string;
  player1_id?: string;
  player2_id?: string;
};

export function useTournamentMatchReadyMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string; matchId: string }) => {
      const { data } = await restClient.post<ReadyResponse>(
        `/tournaments/${vars.tournamentId}/bracket/${vars.matchId}/ready`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void invalidateTournamentCup(qc, vars.tournamentId);
    },
  });
}
