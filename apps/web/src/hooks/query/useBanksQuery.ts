import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { PaymentBank } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";

type BanksResponse = { banks: PaymentBank[] };

export function banksQueryKey() {
  return ["payment-banks"] as const;
}

export function useBanksQuery(enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: banksQueryKey(),
    enabled,
    queryFn: async (): Promise<PaymentBank[]> => {
      const { data } = await restClient.get<BanksResponse>("/payments/banks");
      return data.banks ?? [];
    },
  });
}
