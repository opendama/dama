import { restClient } from "@/lib/api";
import { invalidateTournamentCup } from "@/lib/invalidate";
import type { TournamentBracketMatch } from "@/types/tournament";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type StartGameResponse = {
  match?: TournamentBracketMatch;
  game_id?: string;
  player1_id?: string;
  player2_id?: string;
};

export function useTournamentStartGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string; matchId: string }) => {
      const { data } = await restClient.post<StartGameResponse>(
        `/tournaments/${vars.tournamentId}/bracket/${vars.matchId}/start-game`,
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
