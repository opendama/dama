import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedBracketMatch } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useForfeitHostedEventMatchMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string; matchId: string; userId: string }) => {
      const { data } = await restClient.post<{ match: HostedBracketMatch }>(
        `/events/${vars.eventId}/bracket/${vars.matchId}/forfeit`,
        { user_id: vars.userId },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void invalidateEvents(qc, vars.eventId);
    },
    onError: (err) => {
      const chrome = qc.getQueryData<EventsOrganizerChrome>(eventsOrganizerChromeQueryKey());
      const msg = apiToastMessage(err, (chrome?.toast_forfeit_failed || "").trim());
      if (msg) toast.error(msg);
    },
  });
}
