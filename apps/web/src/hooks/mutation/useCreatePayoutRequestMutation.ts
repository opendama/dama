import { cashRmgChromeQueryKey } from "@/hooks/query/useCashRmgChromeQuery";
import { payoutMethodQueryKey } from "@/hooks/query/usePayoutMethodQuery";
import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import { chromeOnlyToastError } from "@/lib/api-toast-message";
import { cashGateChromeMessage } from "@/lib/cash-gate-error";
import { invalidateWallet } from "@/lib/invalidate";
import { walletChromeErrorMessage } from "@/lib/wallet-chrome-error";
import type { CashRmgPayload } from "@/types/cash-rmg";
import type { CreatePayoutRequestInput, PayoutRequest } from "@/types/payments";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreatePayoutRequestMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePayoutRequestInput): Promise<PayoutRequest> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<PayoutRequest>("/payouts/request", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: () => {
      void invalidateWallet(qc);
      void qc.invalidateQueries({ queryKey: payoutMethodQueryKey(token) });
      void qc.invalidateQueries({ queryKey: ["payout-methods", token] });
      void qc.invalidateQueries({ queryKey: ["my-payouts", token] });
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_request_submitted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const cashPayload = qc.getQueryData<CashRmgPayload>(cashRmgChromeQueryKey());
      const failed = (chrome?.payout_request_failed || "").trim();
      const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
      if (key === "document_kyc_required") {
        chromeOnlyToastError((chrome?.document_kyc_required || "").trim() || failed, {
          id: "wallet-payout-error",
        });
        return;
      }
      // age / phone / locate / jurisdiction → cash chrome; else wallet chrome by key.
      const cashMsg = cashGateChromeMessage(err, cashPayload?.chrome, "");
      if (cashMsg) {
        chromeOnlyToastError(cashMsg, { id: "wallet-payout-error" });
        return;
      }
      chromeOnlyToastError(walletChromeErrorMessage(err, chrome, failed), {
        id: "wallet-payout-error",
      });
    },
  });
}
