import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { consoleCurrencyQueryKey } from "@/hooks/query/useConsoleCurrencyQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidatePaymentCurrency } from "@/lib/invalidate";
import type { PaymentCurrencyConfig } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveConsoleCurrencyMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PaymentCurrencyConfig) => {
      const { data } = await restClient.put<PaymentCurrencyConfig>("/console/currency", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: (cfg) => {
      qc.setQueryData(consoleCurrencyQueryKey(token), cfg);
      void invalidatePaymentCurrency(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.toast_currency_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.payments?.toast_currency_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
