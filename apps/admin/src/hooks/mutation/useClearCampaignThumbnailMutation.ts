import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { getConsoleAdCampaignsChrome } from "@/lib/console-ad-campaigns-cache";
import { apiRestUrl } from "@/lib/env";
import type { AdRuntimeChrome } from "@/types/ad-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  thumbnail_url?: string;
  error?: string;
};

export function useClearCampaignThumbnailMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      if (!token) throw new Error("");
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      const res = await fetch(`${apiRestUrl()}/console/ads/campaigns/${vars.id}/thumbnail`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as UploadResult;
      if (!res.ok) {
        throw new Error((json.error || chrome?.media_upload_failed || "").trim());
      }
      return json;
    },
    onSuccess: () => {
      const chrome = getConsoleAdCampaignsChrome(qc, token) as AdRuntimeChrome | undefined;
      void qc.invalidateQueries({ queryKey: consoleAdCampaignsQueryKey(token) });
      if (chrome?.toast_thumbnail_saved) toast.success(chrome.toast_thumbnail_saved);
    },
    onError: (err) => {
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      const msg = apiToastMessage(err, chrome?.media_upload_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
