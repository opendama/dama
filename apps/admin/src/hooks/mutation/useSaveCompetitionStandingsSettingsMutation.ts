import { clientEnumsQueryKey } from "@/hooks/query/useClientEnumsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { ClientEnums } from "@/types/platform";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CompetitionStandingsSettingsPayload = Pick<
  ClientEnums,
  "competition_standings_points_win" | "competition_standings_points_draw"
>;

export function useSaveCompetitionStandingsSettingsMutation(
  token: string | null | undefined,
  chrome: TournamentChrome | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionStandingsSettingsPayload) => {
      const { data } = await restClient.put<CompetitionStandingsSettingsPayload>(
        "/console/competition/standings-settings",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData<ClientEnums | undefined>(clientEnumsQueryKey(), (prev) =>
        prev ? { ...prev, ...data } : prev,
      );
      const msg = (chrome?.standings_settings_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, (chrome?.standings_settings_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
