import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { getConsoleAdCampaignsChrome } from "@/lib/console-ad-campaigns-cache";
import type { ConsoleAdCampaign } from "@/types/ad-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CampaignScheduleInput = {
  schedule_enabled: boolean;
  first_show_after_seconds: number | null;
  interval_seconds: number | null;
  non_skippable_seconds: number | null;
  daily_impression_cap: number | null;
  weekly_impression_cap: number | null;
  monthly_impression_cap: number | null;
  yearly_impression_cap: number | null;
};

export function useSaveCampaignScheduleMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; schedule: CampaignScheduleInput }) => {
      const { data } = await restClient.patch<ConsoleAdCampaign>(
        `/console/ads/campaigns/${vars.id}/schedule`,
        vars.schedule,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      void qc.invalidateQueries({ queryKey: consoleAdCampaignsQueryKey(token) });
      if (chrome?.toast_schedule_saved) toast.success(chrome.toast_schedule_saved);
    },
    onError: (err) => {
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
