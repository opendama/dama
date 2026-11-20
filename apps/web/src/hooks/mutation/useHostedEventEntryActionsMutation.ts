import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { softHostingToastSaveFailed } from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedEvent, HostedEventEntry } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type EntryAction = "kick";

export function useHostedEventEntryActionsMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string; userId: string; action: EntryAction }) => {
      const { data } = await restClient.post<{ entry: HostedEventEntry; event: HostedEvent }>(
        `/events/${vars.eventId}/entries/${vars.userId}/${vars.action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      void invalidateEvents(qc, data.event?.id);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, softHostingToastSaveFailed(chrome?.toast_save_failed));
      if (msg) toast.error(msg);
    },
  });
}
