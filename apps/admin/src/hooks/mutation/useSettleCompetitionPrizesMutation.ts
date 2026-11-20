import { authHeaders, restClient } from "@/lib/api";
import { invalidateAdminTournaments } from "@/lib/invalidate";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type SettleCompetitionPrizesResult = {
  settled?: number;
  failed?: number;
  due?: number;
};

type SettleChrome = {
  settle_prizes_success_fmt?: string;
  settle_prizes_none_due?: string;
  settle_prizes_failed?: string;
};

function formatSettleToast(fmt: string, settled: number, failed: number, due: number): string {
  // DB fmt: "Settled %d · failed %d · due %d" - apply in order.
  let i = 0;
  const vals = [settled, failed, due];
  return fmt.replace(/%d/g, () => String(vals[i++] ?? 0));
}

export function useSettleCompetitionPrizesMutation(
  token: string | null | undefined,
  chrome?: SettleChrome | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<SettleCompetitionPrizesResult> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<SettleCompetitionPrizesResult>(
        "/console/competitions/settle-prizes",
        {},
        { headers: authHeaders(token) },
      );
      return data ?? {};
    },
    onSuccess: (data) => {
      void invalidateAdminTournaments(qc);
      const settled = Number(data?.settled ?? 0);
      const failed = Number(data?.failed ?? 0);
      const due = Number(data?.due ?? 0);
      if (due <= 0 && settled <= 0) {
        const none = (chrome?.settle_prizes_none_due || "").trim();
        if (none) toast.message(none);
        return;
      }
      const fmt = (chrome?.settle_prizes_success_fmt || "").trim();
      if (fmt) toast.success(formatSettleToast(fmt, settled, failed, due));
    },
    onError: () => {
      const msg = (chrome?.settle_prizes_failed || "").trim();
      if (msg) toast.error(msg);
    },
  });
}
