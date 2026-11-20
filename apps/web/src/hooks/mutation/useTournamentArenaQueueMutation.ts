import { authHeaders, restClient } from "@/lib/api";
import { invalidateTournamentCup } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTournamentArenaQueueMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string }) => {
      const id = vars.tournamentId.trim();
      if (!token) throw new Error("");
      await restClient.post(
        `/tournaments/${encodeURIComponent(id)}/arena/queue`,
        {},
        { headers: authHeaders(token) },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateTournamentCup(qc, vars.tournamentId);
      void qc.invalidateQueries({ queryKey: ["tournament-arena-standings", vars.tournamentId] });
    },
  });
}

export function useTournamentArenaLeaveQueueMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string }) => {
      const id = vars.tournamentId.trim();
      if (!token) throw new Error("");
      await restClient.post(
        `/tournaments/${encodeURIComponent(id)}/arena/queue/leave`,
        {},
        { headers: authHeaders(token) },
      );
    },
    onSuccess: (_data, vars) => {
      void invalidateTournamentCup(qc, vars.tournamentId);
      void qc.invalidateQueries({ queryKey: ["tournament-arena-standings", vars.tournamentId] });
    },
  });
}
