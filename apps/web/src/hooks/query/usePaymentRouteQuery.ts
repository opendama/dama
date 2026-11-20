import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { PaymentRoute } from "@/types/payments";
import { useQuery } from "@tanstack/react-query";

export function paymentRouteQueryKey() {
  return ["payment-route"] as const;
}

/** Server resolves payer country from request IP/GPS (no client country_code). */
export function usePaymentRouteQuery(enabled = true) {
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: paymentRouteQueryKey(),
    enabled,
    queryFn: async (): Promise<PaymentRoute> => {
      const { data } = await restClient.get<PaymentRoute>("/payments/route");
      return data;
    },
  });
}
