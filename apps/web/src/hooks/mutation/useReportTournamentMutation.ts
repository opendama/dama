import { tournamentsPlayerChromeQueryKey } from "@/hooks/query/useTournamentsPlayerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { ReportHostedEventInput } from "@/types/events";
import type { TournamentReport } from "@/types/tournament";
import type { TournamentsPlayerChrome } from "@/types/tournaments-player-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReportTournamentMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { tournamentId: string } & ReportHostedEventInput) => {
      const { tournamentId, ...body } = vars;
      const { data } = await restClient.post<TournamentReport>(
        `/tournaments/${tournamentId}/report`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<TournamentsPlayerChrome>(tournamentsPlayerChromeQueryKey());
      if (chrome?.report_toast_sent) toast.success(chrome.report_toast_sent);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentsPlayerChrome>(tournamentsPlayerChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.report_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
