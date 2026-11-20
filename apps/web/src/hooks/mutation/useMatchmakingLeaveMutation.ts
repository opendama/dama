import { restClient } from "@/lib/api";
import { invalidateMatchmaking } from "@/lib/invalidate";
import type { MatchmakingLeaveResult } from "@/types/player";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMatchmakingLeaveMutation(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MatchmakingLeaveResult> => {
      if (!token) throw new Error("");
      const { data } = await restClient.post<MatchmakingLeaveResult>(
        "/matchmaking/leave",
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
