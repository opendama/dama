import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { apiToastMessage } from "@/lib/api-toast-message";
import { apiRestUrl } from "@/lib/env";
import {
  softHostingToastSaved,
  softHostingToastSaveFailed,
  softHostingUploadLogoFailed,
  softHostingUploadSponsorFailed,
} from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Kind = "logo" | "sponsor-logo";

export function useUploadHostedEventLogoMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file: File; kind: Kind }) => {
      if (!token) throw new Error("");
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const body = new FormData();
      body.append("file", vars.file);
      const path = vars.kind === "sponsor-logo" ? "sponsor-logo" : "logo";
      const res = await fetch(`${apiRestUrl()}/events/${vars.id}/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const json = (await res.json()) as HostedEvent & { error?: string };
      if (!res.ok) {
        const fail =
          vars.kind === "sponsor-logo"
            ? softHostingUploadSponsorFailed(chrome?.upload_sponsor_failed)
            : softHostingUploadLogoFailed(chrome?.upload_logo_failed);
        throw new Error(fail || "");
      }
      return json;
    },
    onSuccess: (data) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      void invalidateEvents(qc, data.id);
      const msg = softHostingToastSaved(chrome?.toast_saved);
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, softHostingToastSaveFailed(chrome?.toast_save_failed));
      if (msg) toast.error(msg);
    },
  });
}
