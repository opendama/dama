import { walletChromeQueryKey } from "@/hooks/query/useWalletChromeQuery";
import { apiRestUrl } from "@/lib/env";
import type { WalletChrome } from "@/types/wallet-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UploadReceiptResult = { receipt_url?: string; error?: string };

export function useUploadReceiptMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!token) throw new Error("");
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${apiRestUrl()}/payments/receipts/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as UploadReceiptResult;
      if (!res.ok || !json.receipt_url) {
        const chrome = qc.getQueryData<WalletChrome>(walletChromeQueryKey());
        throw new Error((chrome?.receipt_upload_failed || "").trim());
      }
      return json.receipt_url;
    },
  });
}
