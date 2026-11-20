import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { type PaymentModalChrome, isPaymentModalChromeReady } from "@/types/payment-modal-chrome";
import { useQuery } from "@tanstack/react-query";

export function paymentModalChromeQueryKey() {
  return ["payment-modal-chrome"] as const;
}

export function usePaymentModalChromeQuery(enabled = true) {
  return useQuery({
    queryKey: paymentModalChromeQueryKey(),
    enabled,
    staleTime: QueryStale.platform,
    queryFn: async (): Promise<PaymentModalChrome> => {
      const { data } = await restClient.get<PaymentModalChrome>("/public/payment-modal-chrome");
      if (!isPaymentModalChromeReady(data)) {
        const msg = (data?.payment_modal_unavailable || "").trim();
        throw new Error(msg);
      }
      return data;
    },
  });
}
