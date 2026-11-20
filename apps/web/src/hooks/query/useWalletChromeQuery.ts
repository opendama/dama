import { restClient } from "@/lib/api";
import { normalizeApiErrorPayload } from "@/lib/api-error-payload";
import { QueryStale } from "@/lib/query-policy";
import { type WalletChrome, isWalletChromeReady } from "@/types/wallet-chrome";
import { useQuery } from "@tanstack/react-query";

export function walletChromeQueryKey() {
  // v4: receipt upload screenshot label + no reference_label (migration 339).
  return ["wallet-chrome", "v4"] as const;
}

export function useWalletChromeQuery(enabled = true) {
  return useQuery({
    queryKey: walletChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<WalletChrome> => {
      // validateStatus: chrome bootstrap 503 body.error IS wallet_chrome_unavailable (DB).
      // Avoid the shared Axios error interceptor stripping that string to an empty ApiClientError.
      const res = await restClient.get<WalletChrome>("/public/wallet-chrome", {
        validateStatus: () => true,
      });
      if (res.status >= 300) {
        const { error } = normalizeApiErrorPayload(res.data);
        throw new Error(error);
      }
      const data = res.data;
      if (!isWalletChromeReady(data)) {
        const msg = (data?.wallet_chrome_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
