import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import type { PublicPlayerResponse } from "@/types/player";
import { useQuery } from "@tanstack/react-query";

export type PublicPlayerMatchRow = PublicPlayerResponse["matches"][number];
export type PublicPlayerPlacementRow = NonNullable<
  PublicPlayerResponse["tournament_placements"]
>[number];

export function usePublicPlayerMatchesQuery(
  playerId: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
) {
  return useQuery({
    staleTime: QueryStale.live,
    placeholderData: (prev) => prev,
    queryKey: ["public-player-matches", playerId, skip, limit] as const,
    enabled: Boolean(playerId) && enabled && limit > 0,
    queryFn: async () => {
      if (!playerId) throw new Error("player id required");
      const { data } = await restClient.get<{
        matches?: PublicPlayerMatchRow[];
        meta?: SkipPaginationMeta;
      }>(`/players/${playerId}/matches`, {
        params: { skip, limit },
      });
      return {
        matches: data.matches ?? [],
        meta: data.meta ?? null,
      };
    },
  });
}

export function usePublicPlayerPlacementsQuery(
  playerId: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
) {
  return useQuery({
    staleTime: QueryStale.live,
    placeholderData: (prev) => prev,
    queryKey: ["public-player-placements", playerId, skip, limit] as const,
    enabled: Boolean(playerId) && enabled && limit > 0,
    queryFn: async () => {
      if (!playerId) throw new Error("player id required");
      const { data } = await restClient.get<{
        tournament_placements?: PublicPlayerPlacementRow[];
        meta?: SkipPaginationMeta;
      }>(`/players/${playerId}/placements`, {
        params: { skip, limit },
      });
      return {
        placements: data.tournament_placements ?? [],
        meta: data.meta ?? null,
      };
    },
  });
}
