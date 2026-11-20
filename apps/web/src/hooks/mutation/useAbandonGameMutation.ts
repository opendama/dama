import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { GamePayload } from "@/types/game";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAbandonGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string): Promise<GamePayload> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<GamePayload>(
        `/games/${gameId}/abandon`,
        {},
        { headers: authHeaders(token) },
      );
      return data;
    },
    onSuccess: (game) => {
      if (game?.id) {
        qc.setQueryData(gameStateQueryKey(game.id), game);
      }
    },
  });
}
