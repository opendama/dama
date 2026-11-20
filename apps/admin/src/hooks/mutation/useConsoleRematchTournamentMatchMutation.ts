import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useConsoleRematchTournamentMatchMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string; matchId: string }) => {
      if (!token) throw new Error("");
      const tid = vars.tournamentId.trim();
      const mid = vars.matchId.trim();
      await restClient.post(
        `/console/tournaments/${encodeURIComponent(tid)}/bracket/${encodeURIComponent(mid)}/rematch`,
        {},
        { headers: authHeaders(token) },
      );
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.err_rematch_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
