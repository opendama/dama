import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { getConsoleAdCampaignsChrome } from "@/lib/console-ad-campaigns-cache";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSetConsoleCampaignStatusMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; status: string }) => {
      const { data } = await restClient.patch(
        `/console/ads/campaigns/${vars.id}/status`,
        { status: vars.status },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      void qc.invalidateQueries({ queryKey: consoleAdCampaignsQueryKey(token) });
      if (chrome?.toast_status_updated) toast.success(chrome.toast_status_updated);
    },
    onError: (err) => {
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      const msg = apiToastMessage(err, chrome?.toast_update_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
