import { SetFeatureFlagDocument } from "@/gql/graphql";
import { adminConsoleChromeQueryKey } from "@/hooks/query/useAdminConsoleChromeQuery";
import { consoleFeatureFlagsQueryKey } from "@/hooks/query/useConsoleFeatureFlagsQuery";
import { consoleNavQueryKey } from "@/hooks/query/useConsoleNavQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { graphqlRequest } from "@/lib/graphql";
import { invalidateConsoleFeatureFlags } from "@/lib/invalidate";
import type { ConsoleFeatureFlags } from "@/types";
import type { AdminConsoleChrome } from "@/types/admin-console-chrome";
import type { ConsoleNavPayload } from "@/types/console";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSetFeatureFlagMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      key: string;
      enabled: boolean;
      mode?: string;
      depths?: number[];
      disabledCountries?: string[];
    }): Promise<ConsoleFeatureFlags> => {
      const empty = (
        qc.getQueryData<ConsoleNavPayload>(consoleNavQueryKey())?.graphql_empty || ""
      ).trim();
      const res = await graphqlRequest(SetFeatureFlagDocument, input, token, empty);
      return res.setFeatureFlag;
    },
    onSuccess: (flags) => {
      qc.setQueryData(consoleFeatureFlagsQueryKey(token), flags);
      void invalidateConsoleFeatureFlags(qc);
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = (chrome?.feature_flags?.toast_updated || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdminConsoleChrome>(adminConsoleChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.feature_flags?.load_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
