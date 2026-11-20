import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { PayoutMethod } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export function payoutMethodQueryKey(token: string | null | undefined) {
  return ["payout-method", token] as const;
}

export function usePayoutMethodQuery(token: string | null | undefined, enabled = true) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: payoutMethodQueryKey(token),
    enabled: hydrated && enabled && Boolean(token),
    queryFn: async (): Promise<PayoutMethod | null> => {
      if (!token) throw new Error("");
      try {
        const { data } = await restClient.get<PayoutMethod>("/payouts/method", {
          headers: authHeaders(token),
        });
        return data;
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });
}
