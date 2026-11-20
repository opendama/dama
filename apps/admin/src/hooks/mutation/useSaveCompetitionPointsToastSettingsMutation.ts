import { competitionPointsToastSettingsQueryKey } from "@/hooks/query/useCompetitionPointsToastSettingsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CompetitionPointsToastSettingsPayload = {
  arena_points_label: string;
  standings_points_label: string;
  toast_points_awarded_fmt: string;
  notif_title_template: string;
  notif_body_template: string;
};

export function useSaveCompetitionPointsToastSettingsMutation(
  token: string | null | undefined,
  chrome: TournamentChrome | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionPointsToastSettingsPayload) => {
      const { data } = await restClient.put<CompetitionPointsToastSettingsPayload>(
        "/console/competition/points-toast-settings",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(competitionPointsToastSettingsQueryKey(token), data);
      const msg = (chrome?.points_toast_settings_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, (chrome?.points_toast_settings_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
