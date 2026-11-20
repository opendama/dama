import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdminUsers } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSetUserActiveMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data } = await restClient.patch(
        `/console/users/${id}/active`,
        { active },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void invalidateAdminUsers(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (
        (vars.active
          ? chrome?.users?.toast_user_activated
          : chrome?.users?.toast_user_deactivated) || ""
      ).trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, "");
      if (msg) toast.error(msg);
    },
  });
}
