import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { officialPauseEventsQueryKey } from "@/hooks/query/useOfficialPauseEventsQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { GamePayload } from "@/types/game";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type OfficialPauseMetaInput = {
  gameId: string;
  reason_key: string;
  note?: string;
};

export function useOfficialPauseMetaMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: OfficialPauseMetaInput): Promise<GamePayload> => {
      const id = vars.gameId.trim();
      // Always send note on meta: empty clears; API omit would keep the prior note.
      const body: { reason_key: string; note: string } = {
        reason_key: vars.reason_key.trim(),
        note: (vars.note || "").trim(),
      };
      const { data } = await restClient.post<GamePayload>(
        `/games/${encodeURIComponent(id)}/official-pause-meta`,
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
