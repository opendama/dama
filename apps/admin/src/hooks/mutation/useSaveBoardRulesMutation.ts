import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { consoleGameRulesQueryKey } from "@/hooks/query/useConsoleGameRulesQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateConsoleBoardRules } from "@/lib/invalidate";
import type { BoardRules } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveBoardRulesMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BoardRules) => {
      const { data } = await restClient.put<BoardRules>("/console/game-rules", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: (payload) => {
      qc.setQueryData(consoleGameRulesQueryKey(token), payload);
      void invalidateConsoleBoardRules(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.progression?.toast_board_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.progression?.toast_save_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
