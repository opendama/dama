import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { GamePayload } from "@/types/game";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function gameStateQueryKey(gameId: string | null | undefined) {
  return ["game-state", gameId] as const;
}

/**
 * Match board hydrate (play / spectate / tournament / PvP).
 * Session-tier stale like lists/tables: navigate away and back paints cache immediately.
 * Live updates stay on WS + mutation setQueryData; never keepPreviousData across gameIds.
 */
export function useGameStateQuery(gameId: string | null | undefined, enabled = true) {
  const qc = useQueryClient();
  const key = gameStateQueryKey(gameId);
  const cached = gameId ? qc.getQueryData<GamePayload>(key) : undefined;
  const cachedAt = gameId ? qc.getQueryState(key)?.dataUpdatedAt : undefined;
  return useQuery({
    staleTime: QueryStale.session,
    placeholderData: () => undefined,
    // Seed from cache on remount so isLoading is false when data already exists.
    initialData: cached,
    initialDataUpdatedAt: cachedAt,
    queryKey: key,
    enabled: enabled && Boolean(gameId),
    queryFn: async (): Promise<GamePayload> => {
      if (!gameId) throw new Error("game id required");
      const { data } = await restClient.get<GamePayload>(`/games/${gameId}/state`);
      return data;
    },
  });
}
