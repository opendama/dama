import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { mapRestTournament, type RestTournamentRow } from "@/hooks/query/useAdminTournamentsQuery";
import { authHeaders, restClient } from "@/lib/api";
import { tournamentChromeApiToast } from "@/lib/api-toast-message";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { AdminTournament } from "@/types";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useStartTournamentCupMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }): Promise<AdminTournament | null> => {
      if (!token) throw new Error("");
      const res = await restClient.post<{ tournament?: RestTournamentRow }>(
        `/console/tournaments/${encodeURIComponent(vars.id)}/start`,
        {},
        { headers: authHeaders(token) },
      );
      const row = res.data?.tournament;
      return row ? mapRestTournament(row) : null;
    },
    onSuccess: () => {
      void invalidateAdminTournaments(qc);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = tournamentChromeApiToast(
        err,
        chrome as Record<string, unknown> | null | undefined,
        (chrome?.err_start_failed || "").trim(),
        ["not_enough_players"],
      );
      if (msg) toast.error(msg);
    },
  });
}
