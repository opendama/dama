import { clientEnumsQueryKey } from "@/hooks/query/useClientEnumsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { ClientEnums } from "@/types/platform";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CompetitionPrizeSettleSettingsPayload = Pick<
  ClientEnums,
  | "competition_prize_auto_settle"
  | "competition_dispute_window_hours"
  | "competition_prize_settle_interval_minutes"
>;

export function useSaveCompetitionPrizeSettleSettingsMutation(
  token: string | null | undefined,
  chrome: TournamentChrome | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionPrizeSettleSettingsPayload) => {
      const { data } = await restClient.put<CompetitionPrizeSettleSettingsPayload>(
        "/console/competition/prize-settle-settings",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData<ClientEnums | undefined>(clientEnumsQueryKey(), (prev) =>
        prev ? { ...prev, ...data } : prev,
      );
      const msg = (chrome?.prize_settle_settings_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, (chrome?.prize_settle_settings_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
