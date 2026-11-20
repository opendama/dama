import { eventsOrganizerChromeQueryKey } from "@/hooks/query/useEventsOrganizerChromeQuery";
import { restClient } from "@/lib/api";
import { apiToastMessage } from "@/lib/api-toast-message";
import { softHostingToastStartFailed } from "@/lib/hosting-organizer-chrome-soft";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedBracketMatch } from "@/types/events";
import type { EventsOrganizerChrome } from "@/types/events-organizer-chrome";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useStartHostedEventGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string; matchId: string }) => {
      const { data } = await restClient.post<{
        match: HostedBracketMatch;
        game_id: string;
        player1_id: string;
        player2_id: string;
      }>(
        `/events/${vars.eventId}/bracket/${vars.matchId}/start-game`,
        {},
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
      const msg = apiToastMessage(err, softHostingToastStartFailed(chrome?.toast_start_failed));
      if (msg) toast.error(msg);
    },
  });
}
