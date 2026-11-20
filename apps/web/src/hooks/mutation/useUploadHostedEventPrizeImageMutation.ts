import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useUploadHostedEventPrizeImageMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const body = new FormData();
      body.append("file", vars.file);
      const res = await fetch(`${apiRestUrl()}/events/${vars.id}/prize-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as HostedEvent & { error?: string };
      if (!res.ok) {
        throw new Error((json.error || chrome?.media_upload_failed || "").trim());
      }
      return json;
    },
    onSuccess: (data) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      void invalidateEvents(qc, data.id);
      const msg = (chrome?.toast_thumbnail_saved || "").trim();
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.media_upload_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
