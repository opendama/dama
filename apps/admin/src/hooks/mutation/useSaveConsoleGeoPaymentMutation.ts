import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import {
  type ConsoleGeoPayment,
  consoleGeoPaymentQueryKey,
} from "@/hooks/query/useConsoleGeoPaymentQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveConsoleGeoPaymentMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConsoleGeoPayment) => {
      const { data } = await restClient.put<ConsoleGeoPayment>("/console/geo-payment", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: (cfg) => {
      qc.setQueryData(consoleGeoPaymentQueryKey(token), cfg);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.toast_geo_payment_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.payments?.toast_geo_payment_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
