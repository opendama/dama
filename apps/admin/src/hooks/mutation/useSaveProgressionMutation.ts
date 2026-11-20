import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { consoleProgressionQueryKey } from "@/hooks/query/useConsoleProgressionQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateConsoleProgression } from "@/lib/invalidate";
import type { ProgressionPayload } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveProgressionMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ProgressionPayload) => {
      const { data } = await restClient.put<ProgressionPayload>("/console/progression", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: (payload) => {
      qc.setQueryData(consoleProgressionQueryKey(token), payload);
      void invalidateConsoleProgression(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.progression?.toast_progression_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.progression?.toast_save_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
