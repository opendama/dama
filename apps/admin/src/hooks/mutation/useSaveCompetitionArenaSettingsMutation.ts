import { clientEnumsQueryKey } from "@/hooks/query/useClientEnumsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { ClientEnums } from "@/types/platform";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CompetitionArenaSettingsPayload = Pick<
  ClientEnums,
  | "competition_arena_points_win"
  | "competition_arena_points_draw"
  | "competition_arena_points_loss"
  | "competition_arena_streak_second_win"
  | "competition_arena_streak_third_plus_win"
  | "competition_arena_default_duration_minutes"
  | "competition_arena_default_pairing_mode"
  | "competition_arena_auto_start"
  | "competition_arena_pair_interval_seconds"
  | "competition_arena_allow_join_while_live"
>;

export function useSaveCompetitionArenaSettingsMutation(
  token: string | null | undefined,
  chrome: TournamentChrome | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionArenaSettingsPayload) => {
      const { data } = await restClient.put<CompetitionArenaSettingsPayload>(
        "/console/competition/arena-settings",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData<ClientEnums | undefined>(clientEnumsQueryKey(), (prev) =>
        prev ? { ...prev, ...data } : prev,
      );
      const msg = (chrome?.arena_settings_toast_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, (chrome?.arena_settings_toast_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
