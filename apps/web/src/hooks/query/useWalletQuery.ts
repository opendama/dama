import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { Wallet } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";

export function walletQueryKey(token: string | null | undefined) {
  return ["wallet", token] as const;
}

/** Server resolves payer country from request IP/GPS (no client country_code). */
export function useWalletQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: walletQueryKey(token),
    enabled: hydrated && enabled && Boolean(token),
    queryFn: async (): Promise<Wallet> => {
      if (!token) throw new Error("");
      const { data } = await restClient.get<Wallet>("/payments/wallet", {
        headers: authHeaders(token),
      });
      return data;
    },
  });
}
