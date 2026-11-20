import { tournamentChromeQueryKey } from "@/hooks/query/useTournamentChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { tournamentChromeApiToast } from "@/lib/api-toast-message";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import type { TournamentChrome } from "@/types/tournament-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type UpdateTournamentPayload = {
  id: string;
  title: string;
  description?: string | null;
  isFree: boolean;
  entryFeeAmount: number;
  entryFeeCurrency: string;
  prizePoolAmount?: number;
  prizePoolCurrency?: string | null;
  prizePoolDisplayEnabled?: boolean;
  prizePoolPlaces?: Record<string, number> | null;
  maxPlayers?: number | null;
  formatId: string;
  arenaDurationMinutes?: number | null;
  prizePayoutMode?: string | null;
  prizePlacePercents?: Record<string, number> | null;
};

export function useUpdateTournamentMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTournamentPayload) => {
      if (!token) throw new Error("");
      const { data } = await restClient.put(
        `/console/tournaments/${encodeURIComponent(id)}`,
        {
          title: body.title,
          description: body.description ?? "",
          is_free: body.isFree,
          entry_fee_amount: body.entryFeeAmount,
          entry_fee_currency: body.entryFeeCurrency,
          prize_pool_amount: body.prizePoolAmount,
          prize_pool_currency: body.prizePoolCurrency,
          prize_pool_display_enabled: body.prizePoolDisplayEnabled,
          prize_pool_places: body.prizePoolPlaces ?? undefined,
          max_players: body.maxPlayers,
          format_id: body.formatId,
          ...(body.arenaDurationMinutes != null && body.arenaDurationMinutes > 0
            ? { arena_duration_minutes: body.arenaDurationMinutes }
            : {}),
          ...(body.prizePayoutMode != null && body.prizePayoutMode.trim() !== ""
            ? { prize_payout_mode: body.prizePayoutMode.trim() }
            : {}),
          ...(body.prizePlacePercents && Object.keys(body.prizePlacePercents).length > 0
            ? { prize_place_percents: body.prizePlacePercents }
            : {}),
        },
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: () => {
      void invalidateAdminTournaments(qc);
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = (chrome?.toast_updated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<TournamentChrome>(tournamentChromeQueryKey());
      const msg = tournamentChromeApiToast(
        err,
        chrome as Record<string, unknown> | undefined,
        chrome?.toast_update_failed || "",
        ["err_unlimited_arena_only", "err_max_players_required"],
      );
      if (msg) toast.error(msg);
    },
  });
}
