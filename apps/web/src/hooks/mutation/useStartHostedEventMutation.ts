import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { isApiClientError } from "@/lib/api-client-error";
import { apiToastMessage } from "@/lib/api-toast-message";
import { softHostingToastStarted } from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedBracketMatch, HostedEvent } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function startHostedErrorChrome(err: unknown, chrome: EventsOrganizerChrome | undefined): string {
  const key = isApiClientError(err) ? (err.errorKey || "").trim() : "";
  if (key && chrome) {
    const keyed = chrome[key as keyof EventsOrganizerChrome];
    if (typeof keyed === "string" && keyed.trim()) return keyed.trim();
  }
  // Fail closed: DB chrome only (no soft invent for start errors).
  return (chrome?.toast_start_failed || "").trim();
}

export function useStartHostedEventMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data } = await restClient.post<{ event: HostedEvent; bracket: HostedBracketMatch[] }>(
        `/events/${eventId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (data) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      void invalidateEvents(qc, data.event?.id);
      const msg = softHostingToastStarted(chrome?.toast_started);
      if (msg) toast.success(msg);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, startHostedErrorChrome(err, chrome));
      if (msg) toast.error(msg);
    },
  });
}
