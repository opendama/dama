import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { PublicPlayerResponse } from "@/types/player";
import { useQuery } from "@tanstack/react-query";

export function publicPlayerQueryKey(playerId: string | null | undefined) {
  return ["public-player", playerId] as const;
}

export function usePublicPlayerQuery(playerId: string | null | undefined, enabled = true) {
  return useQuery({
    /** Online status and seat cards must not stay stale across remounts. */
    staleTime: QueryStale.live,
    /** Never paint the previous player's profile when playerId changes. */
    placeholderData: () => undefined,
    queryKey: publicPlayerQueryKey(playerId),
    enabled: Boolean(playerId) && enabled,
    queryFn: async (): Promise<PublicPlayerResponse> => {
      if (!playerId) throw new Error("player id required");
      const { data } = await restClient.get<PublicPlayerResponse>(`/players/${playerId}`);
      return data;
    },
  });
}
