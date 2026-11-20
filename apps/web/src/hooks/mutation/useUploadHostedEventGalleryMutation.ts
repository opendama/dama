import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function postGalleryFile(
  token: string,
  id: string,
  file: File,
  failedMsg: string,
): Promise<HostedEvent> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${apiRestUrl()}/events/${id}/gallery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const json = (await res.json()) as HostedEvent & { error?: string };
  if (!res.ok) {
    throw new Error((json.error || failedMsg).trim());
  }
  return json;
}

export function useUploadHostedEventGalleryMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file?: File; files?: File[] }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const failed = (chrome?.media_upload_failed || "").trim();
      const files = (vars.files?.length ? vars.files : vars.file ? [vars.file] : []).filter(
        Boolean,
      ) as File[];
      if (files.length === 0) throw new Error(failed);
      let last: HostedEvent | null = null;
      for (const file of files) {
        last = await postGalleryFile(token, vars.id, file, failed);
      }
      if (!last) throw new Error(failed);
      return last;
    },
    onSuccess: (data) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      void invalidateEvents(qc, data.id);
      const msg = (chrome?.toast_gallery_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.media_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
