import { invalidateTournamentCup } from "@/lib/invalidate";
import { restClient } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTournamentCheckInMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string }) => {
      const id = vars.tournamentId.trim();
      await restClient.post(
        `/tournaments/${id}/check-in`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateTournamentCup(qc, vars.tournamentId);
    },
  });
}
