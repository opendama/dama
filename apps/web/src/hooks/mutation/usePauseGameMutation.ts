import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { postGamePause } from "@/lib/pause-active-game";
import type { GamePayload } from "@/types/game";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function usePauseGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string): Promise<GamePayload> => {
      return postGamePause(token || "", gameId);
    },
    onSuccess: (game) => {
      if (game?.id) {
        qc.setQueryData(gameStateQueryKey(game.id), game);
      }
    },
  });
}
