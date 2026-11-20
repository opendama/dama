import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { officialPauseEventsQueryKey } from "@/hooks/query/useOfficialPauseEventsQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { GamePayload } from "@/types/game";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type OfficialPauseGameInput = {
  gameId: string;
  reason_key: string;
  note?: string;
};

export function useOfficialPauseGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: OfficialPauseGameInput): Promise<GamePayload> => {
      const id = vars.gameId.trim();
      const body: { reason_key: string; note?: string } = {
        reason_key: vars.reason_key.trim(),
      };
      const note = (vars.note || "").trim();
      if (note) body.note = note;
      const { data } = await restClient.post<GamePayload>(
        `/games/${encodeURIComponent(id)}/official-pause`,
        body,
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: (game) => {
      if (game?.id) {
        qc.setQueryData(gameStateQueryKey(game.id), game);
        void qc.invalidateQueries({ queryKey: officialPauseEventsQueryKey(game.id) });
      }
      void qc.invalidateQueries({ queryKey: ["event-live-boards"] });
    },
  });
}
