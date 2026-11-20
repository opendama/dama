import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthHydrated } from "@/store/auth";
import type { PaymentCurrencyConfig } from "@/types";
import { useQuery } from "@tanstack/react-query";

export function consoleCurrencyQueryKey(token: string | null | undefined) {
  return ["console-currency", token] as const;
}

export function useConsoleCurrencyQuery(token: string | null | undefined, enabled: boolean) {
  const hydrated = useAuthHydrated();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: consoleCurrencyQueryKey(token),
    enabled: hydrated && Boolean(token) && enabled,
    queryFn: async () => {
      const { data } = await restClient.get<PaymentCurrencyConfig>("/console/currency", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
}
