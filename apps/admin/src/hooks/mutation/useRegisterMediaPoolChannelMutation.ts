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

export function useRegisterMediaPoolChannelMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      channel_id: string;
      label: string;
      client_id?: string;
      client_secret?: string;
      refresh_token?: string;
      api_key?: string;
      daily_quota_limit: number;
    }) => {
      const t = requireToken(token);
      const { data } = await restClient.post("/media/pool/channels", payload, {
        headers: authHeaders(t),
      });
      return data;
    },
    onSuccess: () => {
      void invalidateMediaPool(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.media_pool?.toast_registered || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, "");
      if (msg) toast.error(msg);
    },
  });
}
