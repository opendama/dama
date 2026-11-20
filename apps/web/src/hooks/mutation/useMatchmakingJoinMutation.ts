import { restClient } from "@/lib/api";
import { invalidateMatchmaking } from "@/lib/invalidate";
import type { MatchmakingJoinResult } from "@/types/player";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMatchmakingJoinMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MatchmakingJoinResult> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<MatchmakingJoinResult>(
        "/matchmaking/join",
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    },
    onSuccess: () => {
      void invalidateMatchmaking(qc, token);
    },
  });
}
