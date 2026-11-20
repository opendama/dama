import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import {
  type ConsoleTelegramOps,
  consoleTelegramOpsQueryKey,
} from "@/hooks/query/useConsoleTelegramOpsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type SaveConsoleTelegramOpsPayload = {
  enabled: boolean;
  bot_service_url: string;
  bot_api_key: string;
  reviewer_user_id: string;
  notify_timeout_ms: number;
};

export function useSaveConsoleTelegramOpsMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveConsoleTelegramOpsPayload) => {
      const { data } = await restClient.put<ConsoleTelegramOps>(
        "/console/telegram-ops-bot",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: (cfg) => {
      qc.setQueryData(consoleTelegramOpsQueryKey(token), cfg);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.payments?.toast_telegram_ops_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, chrome?.payments?.toast_telegram_ops_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
