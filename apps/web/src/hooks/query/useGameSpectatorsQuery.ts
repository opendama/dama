import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import type { PlayersSearchRow } from "@/hooks/query/usePlayersSearchQuery";
import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useGameSpectatorsQuery(gameId: string | null, enabled = true) {
  const id = (gameId || "").trim();
  return useQuery({
    queryKey: ["games", "spectators", id] as const,
    enabled: enabled && Boolean(id),
    staleTime: QueryStale.live,
    refetchInterval: 12_000,
    placeholderData: () => undefined,
    queryFn: async () => {
      const { data } = await restClient.get<{
        spectator_count?: number;
        viewers?: PlayersSearchRow[];
      }>(`/games/${encodeURIComponent(id)}/spectators`);
      if (typeof data.spectator_count !== "number" || !Array.isArray(data.viewers)) {
        throw new Error("spectators payload incomplete");
      }
      return {
        spectator_count: data.spectator_count,
        viewers: data.viewers,
      };
    },
  });
}

/** Trim-bell infinite scroll for live viewers drill-in. Optional q is server-side username search. */
export function useGameSpectatorsInfinite(
  gameId: string | null,
  limit: number,
  enabled = true,
  q = "",
) {
  const id = (gameId || "").trim();
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: ["games", "spectators", "infinite", id, pageSize, needle] as const,
    enabled: enabled && Boolean(id) && pageSize > 0,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite lists - refetching every page reshuffles/glitches scroll.
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        spectator_count?: number;
        viewers?: PlayersSearchRow[];
        meta?: SkipPaginationMeta;
      }>(`/games/${encodeURIComponent(id)}/spectators`, {
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
      });
      if (typeof data.spectator_count !== "number" || !Array.isArray(data.viewers)) {
        throw new Error("spectators payload incomplete");
      }
      return {
        spectator_count: data.spectator_count,
        viewers: data.viewers,
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.viewers?.length ?? 0),
  });
}
