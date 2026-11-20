import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useDeleteTournamentMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!token) throw new Error("");
      await restClient.delete(`/console/tournaments/${encodeURIComponent(id)}`, {
        headers: authHeaders(token),
      });
      return id;
    },
    onSuccess: () => {
      void invalidateAdminTournaments(qc);
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = (chrome?.toast_deleted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.toast_delete_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
