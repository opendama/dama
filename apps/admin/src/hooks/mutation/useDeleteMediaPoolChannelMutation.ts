import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateMediaPool } from "@/lib/invalidate";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function requireToken(token: string | null | undefined): string {
  if (!token) throw new Error("");
  return token;
}

export function useDeleteMediaPoolChannelMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const t = requireToken(token);
      await restClient.delete(`/media/pool/channels/${id}`, {
        headers: authHeaders(t),
      });
      return id;
    },
    onSuccess: () => {
      void invalidateMediaPool(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.media_pool?.toast_channel_deleted || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(
        err,
        (chrome?.media_pool?.toast_channel_delete_failed || "").trim(),
      );
      if (msg) toast.error(msg);
    },
  });
}
