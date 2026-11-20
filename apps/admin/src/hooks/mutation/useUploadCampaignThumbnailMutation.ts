import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { getConsoleAdCampaignsChrome } from "@/lib/console-ad-campaigns-cache";
import { apiRestUrl } from "@/lib/env";
import type { AdRuntimeChrome } from "@/types/ad-runtime";
import { isAdMediaChromeReady } from "@/types/ad-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  thumbnail_url?: string;
  error?: string;
};

export function useUploadCampaignThumbnailMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      if (!token) throw new Error("");
      const chrome = getConsoleAdCampaignsChrome(qc, token);
      const media = isAdMediaChromeReady(chrome) ? chrome : undefined;
      const body = new FormData();
      body.append("file", vars.file);
      const res = await fetch(`${apiRestUrl()}/console/ads/campaigns/${vars.id}/thumbnail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as UploadResult;
      if (!res.ok) {
        throw new Error((json.error || media?.media_upload_failed || "").trim());
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
