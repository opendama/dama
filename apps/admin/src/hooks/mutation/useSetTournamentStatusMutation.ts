import { mapRestTournament, type RestTournamentRow } from "@/hooks/query/useAdminTournamentsQuery";
import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { tournamentChromeApiToast } from "@/lib/api-toast-message";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { AdminTournament } from "@/types";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Console status soft-lifecycle via REST (chrome error_key; GraphQL path kept for schema clients). */
export function useSetTournamentStatusMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }): Promise<AdminTournament | null> => {
      if (!token) throw new Error("");
      const res = await restClient.patch<RestTournamentRow>(
        `/console/tournaments/${encodeURIComponent(id)}/status`,
        { status },
        { headers: authHeaders(token) },
      );
      return res.data ? mapRestTournament(res.data) : null;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = (chrome?.toast_status_updated || "").trim();
      if (msg) toast.success(msg);
      void invalidateAdminTournaments(qc);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = tournamentChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        (chrome?.toast_status_failed || "").trim(),
      );
      if (msg) toast.error(msg);
    },
  });
}
