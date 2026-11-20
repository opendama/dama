import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import type {
  AdPlayback,
  AdPlaybackConsolePayload,
  AdPlaybackUpdatePayload,
} from "@/types/ad-runtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSaveAdPlaybackMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AdPlaybackUpdatePayload) => {
      const { data } = await restClient.put<AdPlayback>("/console/ads/playback", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<AdPlaybackConsolePayload>(adPlaybackQueryKey(token))?.chrome;
      void qc.invalidateQueries({ queryKey: adPlaybackQueryKey(token) });
      if (chrome?.toast_playback_saved) toast.success(chrome.toast_playback_saved);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdPlaybackConsolePayload>(adPlaybackQueryKey(token))?.chrome;
      const msg = apiToastMessage(err, chrome?.toast_save_failed || "");
      if (msg) toast.error(msg);
    },
  });
}
