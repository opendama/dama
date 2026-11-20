import { payoutMethodQueryKey } from "@/hooks/query/usePayoutMethodQuery";
import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { PayoutMethod, UpsertPayoutMethodInput } from "@/types/payments";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function invalidateMethods(
  qc: ReturnType<typeof useQueryClient>,
  token: string | null | undefined,
) {
  void qc.invalidateQueries({ queryKey: payoutMethodQueryKey(token) });
  void qc.invalidateQueries({ queryKey: ["payout-methods", token] });
}

export function useCreatePayoutMethodMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpsertPayoutMethodInput): Promise<PayoutMethod> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<PayoutMethod>("/payouts/methods", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: () => {
      invalidateMethods(qc, token);
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: () => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_save_failed || "").trim();
      if (msg) toast.error(msg);
    },
  });
}

export function useUpdatePayoutMethodMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: UpsertPayoutMethodInput & { id: string },
    ): Promise<PayoutMethod> => {
      if (!token) throw new Error("");
      const { id, ...body } = payload;
      const { data } = await restClient.patch<PayoutMethod>(`/payouts/methods/${id}`, body, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: () => {
      invalidateMethods(qc, token);
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg =
        (chrome?.payout_method_updated || "").trim() || (chrome?.payout_method_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: () => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_save_failed || "").trim();
      if (msg) toast.error(msg);
    },
  });
}

export function useDeletePayoutMethodMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!token) throw new Error("");
      await restClient.delete(`/payouts/methods/${id}`, {
        headers: authHeaders(token),
      });
    },
    onSuccess: () => {
      invalidateMethods(qc, token);
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_deleted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: () => {
      const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
      const msg = (chrome?.payout_method_delete_failed || "").trim();
      if (msg) toast.error(msg);
    },
  });
}
