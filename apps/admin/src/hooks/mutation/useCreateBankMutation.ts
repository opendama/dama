import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdminBanks } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import type { CreateBankInput } from "@/types/payments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCreateBankMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBankInput) => {
      const { data } = await restClient.post(
        "/console/banks",
        { ...payload, is_active: true },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void invalidateAdminBanks(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.banks?.toast_added || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.banks?.toast_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
