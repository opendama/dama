import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import {
  softHostingToastSaved,
  softHostingToastSaveFailed,
} from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedEvent, PatchHostedEventInput } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function usePatchHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string } & PatchHostedEventInput) => {
      const { id, ...body } = vars;
      const { data } = await restClient.patch<HostedEvent>(`/events/${id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
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
