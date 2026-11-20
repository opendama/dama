import { restClient } from "@/lib/api";
import type { TournamentReport } from "@/types/tournament-reports";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDismissTournamentReportMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<TournamentReport> => {
      const { data } = await restClient.patch<TournamentReport>(
        `/console/tournaments/reports/${encodeURIComponent(reportId)}/dismiss`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console", "tournament-reports"] });
    },
  });
}

export function useResolveTournamentReportMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string): Promise<TournamentReport> => {
      const { data } = await restClient.patch<TournamentReport>(
        `/console/tournaments/reports/${encodeURIComponent(reportId)}/resolve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["console", "tournament-reports"] });
    },
  });
}
