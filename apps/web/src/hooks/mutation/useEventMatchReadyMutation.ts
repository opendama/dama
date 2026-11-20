import { restClient } from "@/lib/api";
import { invalidateEvents } from "@/lib/invalidate";
import type { HostedBracketMatch } from "@/types/events";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ReadyResponse = {
  match?: HostedBracketMatch;
  game_id?: string;
  player1_id?: string;
  player2_id?: string;
};

export function useEventMatchReadyMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { eventId: string; matchId: string }) => {
      const { data } = await restClient.post<ReadyResponse>(
        `/events/${vars.eventId}/bracket/${vars.matchId}/ready`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void invalidateEvents(qc, vars.eventId);
    },
  });
}
