import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdminBanks } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useToggleBankMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data } = await restClient.patch(
        `/console/banks/${id}`,
        { active },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void invalidateAdminBanks(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.banks?.toast_updated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.banks?.toast_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
