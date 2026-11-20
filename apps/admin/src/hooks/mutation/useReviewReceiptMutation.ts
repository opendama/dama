import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { adminReceiptQueryKey } from "@/hooks/query/useAdminReceiptQuery";
import type { AdminReceiptsListResponse } from "@/hooks/query/useAdminReceiptsQuery";
import { restClient } from "@/lib/api";
import { paymentsChromeApiToast } from "@/lib/api-toast-message";
import { invalidateAdminReceipts } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import type { AdminReceipt } from "@/types/console";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useReviewReceiptMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { data } = await restClient.post<AdminReceipt>(
        `/payments/receipts/${id}/review`,
        { approve },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: async (data, vars) => {
      const id = (vars.id || "").trim();
      if (token && id && data) {
        const next: AdminReceipt = {
          ...(qc.getQueryData<AdminReceipt>(adminReceiptQueryKey(token, id)) ||
            ({} as AdminReceipt)),
          ...data,
          id: (data.id || id).trim() || id,
        };
        qc.setQueryData(adminReceiptQueryKey(token, id), next);
        qc.setQueriesData<AdminReceiptsListResponse>({ queryKey: ["admin-receipts"] }, (prev) => {
          if (!prev?.receipts?.length) return prev;
          return {
            ...prev,
            receipts: prev.receipts.map((r) =>
              (r.id || "").trim() === id ? { ...r, ...next } : r,
            ),
          };
        });
      }
      await invalidateAdminReceipts(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.toast_receipt_reviewed || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const payments = chrome?.payments as unknown as Record<string, unknown> | undefined;
      const msg = paymentsChromeApiToast(
        err,
        payments,
        chrome?.payments?.toast_receipt_failed || "",
      );
      if (msg) toast.error(msg);
      // Stale UI after concurrent review: refresh lists so actions re-gate.
      void invalidateAdminReceipts(qc);
    },
  });
}
