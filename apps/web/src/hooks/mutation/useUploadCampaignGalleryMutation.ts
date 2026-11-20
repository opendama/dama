import { adPlaybackQueryKey } from "@/hooks/query/useAdPlaybackQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateAdPublisher } from "@/lib/invalidate";
import type { AdPlayback } from "@/types/ad-playback";
import { isAdMediaChromeReady } from "@/types/ad-playback";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type UploadResult = {
  gallery?: string[];
  error?: string;
};

async function postGalleryFile(
  token: string,
  id: string,
  file: File,
  failedMsg: string,
): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiRestUrl()}/ads/campaigns/${id}/gallery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = (await res.json()) as UploadResult;
  if (!res.ok) {
    throw new Error((json.error || failedMsg).trim());
  }
  return json;
}

export function useUploadCampaignGalleryMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file?: File; files?: File[] }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const media = isAdMediaChromeReady(chrome) ? chrome : undefined;
      const failed = (media?.media_upload_failed || "").trim();
      const files = (vars.files?.length ? vars.files : vars.file ? [vars.file] : []).filter(
        Boolean,
      ) as File[];
      if (files.length === 0) throw new Error(failed);
      let last: UploadResult = {};
      for (const file of files) {
        last = await postGalleryFile(token, vars.id, file, failed);
      }
      return last;
    },
    onSuccess: () => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      void invalidateAdPublisher(qc, token);
      if (chrome?.toast_gallery_saved) toast.success(chrome.toast_gallery_saved);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<AdPlayback>(adPlaybackQueryKey())?.schedule_chrome;
      const msg = apiToastMessage(err, (chrome?.media_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
