import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { restClient } from "@/lib/api";
import { paymentsChromeApiToast } from "@/lib/api-toast-message";
import { invalidateAdminPayouts } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReviewPayoutMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: string;
      note?: string;
    }) => {
      const { data } = await restClient.post(
        `/payouts/console/${id}/review`,
        { status, note: note || "" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async () => {
      await invalidateAdminPayouts(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.payout_reviewed || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const payments = chrome?.payments as unknown as Record<string, unknown> | undefined;
      const msg = paymentsChromeApiToast(
        err,
        payments,
        chrome?.payments?.payout_review_failed || "",
      );
      if (msg) toast.error(msg);
      void invalidateAdminPayouts(qc);
    },
  });
}
