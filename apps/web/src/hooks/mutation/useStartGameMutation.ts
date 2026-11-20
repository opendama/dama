import { gameStateQueryKey } from "@/hooks/query/useGameStateQuery";
import { authHeaders, restClient } from "@/lib/api";
import type { GamePayload, StartGameInput } from "@/types/game";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type { StartGameInput } from "@/types/game";

export function useStartGameMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StartGameInput): Promise<GamePayload> => {
      const { data } = await restClient.post<GamePayload>("/games/start", payload, {
        headers: authHeaders(token),
      });
      return data;
    },
    onSuccess: (game) => {
      if (game?.id) {
        qc.setQueryData(gameStateQueryKey(game.id), game);
      }
    },
  });
}
