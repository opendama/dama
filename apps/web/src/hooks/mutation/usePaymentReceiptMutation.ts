import { cashRmgChromeQueryKey } from "@/hooks/query/useCashRmgChromeQuery";
import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { cashGateChromeMessage } from "@/lib/cash-gate-error";
import { invalidatePaymentRoute, invalidateWallet } from "@/lib/invalidate";
import type { CashRmgPayload } from "@/types/cash-rmg";
import type { PaymentReceiptInput } from "@/types/payments";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function usePaymentReceiptMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PaymentReceiptInput) => {
      if (!token) throw new Error("");
      const { data } = await restClient.post("/payments/receipts", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: () => {
      void invalidateWallet(qc);
      void invalidatePaymentRoute(qc);
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.receipt_submitted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const cashPayload = qc.getQueryData<CashRmgPayload>(cashRmgChromeQueryKey());
      const fallback = apiToastMessage(err, chrome?.receipt_submit_failed || "");
      const msg = cashGateChromeMessage(err, cashPayload?.chrome, fallback);
      if (msg) toast.error(msg);
    },
  });
}
