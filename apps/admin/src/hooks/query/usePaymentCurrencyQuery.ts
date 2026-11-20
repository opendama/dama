import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { PaymentCurrencyConfig } from "@/types";
import { useQuery } from "@tanstack/react-query";

export const paymentCurrencyQueryKey = ["payment-currency"] as const;

export function usePaymentCurrencyQuery() {
  return useQuery({
    staleTime: QueryStale.platform,
    queryKey: paymentCurrencyQueryKey,
    queryFn: async () => {
      const { data } = await restClient.get<PaymentCurrencyConfig>("/payments/currency");
      return data;
    },
  });
}
