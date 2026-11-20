import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { GamePayload } from "@/types/game";
import { useQuery } from "@tanstack/react-query";

export function adminGameStateQueryKey(gameId: string) {
  return ["admin-game-state", gameId] as const;
}

export function useAdminGameStateQuery(
  token: string | null | undefined,
  gameId: string | null | undefined,
  enabled = true,
) {
  const gid = (gameId || "").trim();
  return useQuery({
    queryKey: adminGameStateQueryKey(gid),
    enabled: Boolean(enabled && token && gid),
    staleTime: QueryStale.live,
    refetchInterval: 5_000,
    queryFn: async (): Promise<GamePayload> => {
      if (!token || !gid) throw new Error("");
      const { data } = await restClient.get<GamePayload>(
        `/games/${encodeURIComponent(gid)}/state`,
        { headers: authHeaders(token) },
      );
      return data;
    },
  });
}
