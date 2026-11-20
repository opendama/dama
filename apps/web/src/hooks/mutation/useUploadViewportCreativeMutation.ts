import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateAdPublisher } from "@/lib/invalidate";
import type { ViewportCreativeSlot } from "@/types/ads";
import type { AdPlayback } from "@/types/ad-playback";
import { isViewportCreativesChromeReady } from "@/types/ad-playback";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  error?: string;
};

export function useUploadViewportCreativeMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; slot: ViewportCreativeSlot; file: File }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const media = isViewportCreativesChromeReady(chrome) ? chrome : undefined;
      if (!media) throw new Error((chrome?.playback_unavailable || "").trim());
      const body = new FormData();
      body.append("file", vars.file);
      const res = await fetch(`${apiRestUrl()}/ads/campaigns/${vars.id}/creatives/${vars.slot}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as UploadResult;
      if (!res.ok) {
        throw new Error((json.error || media.media_upload_failed || "").trim());
      }
      return json;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      void invalidateAdPublisher(qc, token);
      if (chrome?.toast_viewport_creative_saved) {
        toast.success(chrome.toast_viewport_creative_saved);
      }
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const media = isViewportCreativesChromeReady(chrome) ? chrome : undefined;
      const msg = apiToastMessage(err, (media?.media_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
