import { clientEnumsQueryKey } from "@/hooks/query/useClientEnumsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { ClientEnums } from "@/types/platform";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CompetitionPayoutDefaultsPayload = Pick<
  ClientEnums,
  | "competition_default_payout_mode_knockout"
  | "competition_default_payout_mode_round_robin"
  | "competition_default_payout_mode_swiss"
  | "competition_default_payout_mode_groups_knockout"
  | "competition_default_payout_mode_arena"
  | "competition_default_place_percent_1"
  | "competition_default_place_percent_2"
  | "competition_default_place_percent_3"
  | "competition_dual_purse_place_percent"
>;

export function useSaveCompetitionPayoutDefaultsMutation(
  token: string | null | undefined,
  chrome: TournamentChrome | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionPayoutDefaultsPayload) => {
      const { data } = await restClient.put<CompetitionPayoutDefaultsPayload>(
        "/console/competition/payout-defaults-settings",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData<ClientEnums | undefined>(clientEnumsQueryKey(), (prev) =>
        prev ? { ...prev, ...data } : prev,
      );
      const msg = (chrome?.payout_settings_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, (chrome?.payout_settings_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
