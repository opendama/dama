import { banksQueryKey } from "@/hooks/query/useBanksQuery";
import { cashRmgChromeQueryKey } from "@/hooks/query/useCashRmgChromeQuery";
import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { chromeOnlyToastError } from "@/lib/api-toast-message";
import {
  cashGateChromeMessage,
  isAgeRequiredError,
  isPhoneKycRequiredError,
} from "@/lib/cash-gate-error";
import { invalidatePaymentRoute, invalidateWallet } from "@/lib/invalidate";
import { walletChromeErrorMessage } from "@/lib/wallet-chrome-error";
import type { CashRmgPayload } from "@/types/cash-rmg";
import { type CheckoutInput, type CheckoutResult, isManualCheckoutResult } from "@/types/payments";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCheckoutMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CheckoutInput): Promise<CheckoutResult> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<CheckoutResult>("/payments/checkout", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: (res) => {
      void invalidateWallet(qc);
      void invalidatePaymentRoute(qc);
      if ((res.banks?.length ?? 0) > 0) {
        qc.setQueryData(banksQueryKey(), res.banks);
      }
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const ready = (chrome?.checkout_ready || "").trim();
      const cur = (res.route?.currency || "").trim();
      const open = (chrome?.paren_open || "").trim();
      const close = (chrome?.paren_close || "").trim();
      if (ready) {
        toast.success(cur && open && close ? `${ready}${open}${cur}${close}` : ready);
      }
      const checkoutUrl = (res.intent?.checkout_url || "").trim();
      // Manual: no gateway URL - callers open banks/receipt UI.
      if (!checkoutUrl || isManualCheckoutResult(res)) return;
      // Same-tab assign avoids popup blockers (async mutate is not a direct gesture).
      window.location.assign(checkoutUrl);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const cashPayload = qc.getQueryData<CashRmgPayload>(cashRmgChromeQueryKey());
      // Age / phone: one cash-chrome toast (wallet UI also opens the gate dialog).
      if (isAgeRequiredError(err) || isPhoneKycRequiredError(err)) {
        chromeOnlyToastError(cashGateChromeMessage(err, cashPayload?.chrome, ""), {
          id: "wallet-cash-gate-error",
        });
        return;
      }
      // One wallet chrome toast only - never API JSON / Error.message / dual toasts.
      chromeOnlyToastError(
        walletChromeErrorMessage(err, chrome, (chrome?.checkout_failed || "").trim()),
        { id: "wallet-checkout-error" },
      );
    },
  });
}
