import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { authHeaders, restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateMediaPool } from "@/lib/invalidate";
import type { MediaPoolTestResult } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function requireToken(token: string | null | undefined): string {
  if (!token) throw new Error("");
  return token;
}

export function useTestMediaPoolChannelMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const t = requireToken(token);
      const { data } = await restClient.post<MediaPoolTestResult>(
        `/media/pool/channels/${id}/test`,
        {},
        { headers: authHeaders(t) },
      );
      return data;
    },
    onSuccess: (res) => {
      void invalidateMediaPool(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      if (res.ready) {
        const msg = (chrome?.media_pool?.toast_channel_ready || "").trim();
        if (msg) toast.success(msg);
      } else {
        const msg = apiToastMessage(null, (chrome?.media_pool?.toast_upload_failed || "").trim());
        if (msg) toast.error(msg);
      }
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.media_pool?.toast_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
