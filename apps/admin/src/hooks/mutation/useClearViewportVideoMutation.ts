import { consoleAdCampaignsQueryKey } from "@/hooks/query/useConsoleAdCampaignsQuery";
import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { getConsoleAdCampaignsChrome } from "@/lib/console-ad-campaigns-cache";
import { apiRestUrl } from "@/lib/env";
import type {
  AdPlaybackConsolePayload,
  AdRuntimeChrome,
  ViewportCreativeSlot,
} from "@/types/ad-runtime";
import { isViewportCreativesChromeReady } from "@/types/ad-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  error?: string;
};

function runtimeChrome(qc: ReturnType<typeof useQueryClient>, token: string | null | undefined) {
  return (
    getConsoleAdCampaignsChrome(qc, token) ??
    qc.getQueryData<AdPlaybackConsolePayload>(adPlaybackQueryKey(token))?.chrome
  );
}

export function useClearViewportVideoMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; slot: ViewportCreativeSlot }) => {
      if (!token) throw new Error("");
      const chrome = runtimeChrome(qc, token);
      const media = isViewportCreativesChromeReady(chrome) ? chrome : undefined;
      if (!media) throw new Error((chrome?.playback_unavailable || "").trim());
      const res = await fetch(
        `${apiRestUrl()}/console/ads/campaigns/${vars.id}/creatives/${vars.slot}/video`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const json = (await res.json()) as UploadResult;
      if (!res.ok) {
        throw new Error((json.error || media.media_upload_failed || "").trim());
      }
      return json;
    },
    onSuccess: () => {
      const chrome = runtimeChrome(qc, token) as AdRuntimeChrome | undefined;
      void qc.invalidateQueries({ queryKey: consoleAdCampaignsQueryKey(token) });
      if (chrome?.toast_viewport_creative_cleared) {
        toast.success(chrome.toast_viewport_creative_cleared);
      }
    },
    onError: (err) => {
      const chrome = runtimeChrome(qc, token);
      const media = isViewportCreativesChromeReady(chrome) ? chrome : undefined;
      const msg = apiToastMessage(err, (media?.media_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
