import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { moderationSettingsQueryKey } from "@/hooks/query/useModerationSettingsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateAdminModeration } from "@/lib/invalidate";
import type { ModerationSettings } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveModerationSettingsMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: ModerationSettings) => {
      const { data } = await restClient.put<ModerationSettings>("/console/moderation", next, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(moderationSettingsQueryKey(token), data);
      void invalidateAdminModeration(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.avatars?.toast_moderation_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const msg = apiToastMessage(err, "");
      if (msg) toast.error(msg);
    },
  });
}
