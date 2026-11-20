import { payoutMethodQueryKey } from "@/hooks/query/usePayoutMethodQuery";
import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { PayoutMethod, UpsertPayoutMethodInput } from "@/types/payments";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUpsertPayoutMethodMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertPayoutMethodInput): Promise<PayoutMethod> => {
      if (!token) throw new Error("");
      const { data } = await restClient.put<PayoutMethod>("/payouts/method", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: payoutMethodQueryKey(token) });
      void qc.invalidateQueries({ queryKey: ["payout-methods", token] });
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: () => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg =
        (chrome?.payout_method_save_failed || "").trim() ||
        (chrome?.payout_phone_required || "").trim();
      if (msg) toast.error(msg);
    },
  });
}
