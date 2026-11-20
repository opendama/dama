import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export type LiveGameViewer = {
  id: string;
  username: string;
  rating?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  country_code?: string | null;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
};

export type LiveGameRow = {
  id: string;
  mode?: string;
  move_count?: number;
  time_control_seconds?: number;
  spectator_count?: number;
  viewers?: LiveGameViewer[];
  player1_id?: string;
  player2_id?: string;
  player1_username?: string;
  player2_username?: string;
  player1_rating?: number;
  player2_rating?: number;
  player1_wins?: number;
  player2_wins?: number;
  player1_losses?: number;
  player2_losses?: number;
  player1_draws?: number;
  player2_draws?: number;
  player1_avatar_thumb_url?: string | null;
  player2_avatar_thumb_url?: string | null;
  player1_avatar_full_url?: string | null;
  player2_avatar_full_url?: string | null;
  player1_country_code?: string | null;
  player2_country_code?: string | null;
  player1_host_trust_tier?: string | null;
  player2_host_trust_tier?: string | null;
  player1_host_trust_badge?: string | null;
  player2_host_trust_badge?: string | null;
};

/** Legacy single-page fetch (skip=0). Prefer useLiveGamesInfinite for rail lists.
 * `limit` must come from DB chrome (`list_page_size`) - never invent a default. */
export function useLiveGamesQuery(enabled = true, limit = 0) {
  const pageSize = limit > 0 ? limit : 0;
  return useQuery({
    queryKey: ["games", "live", pageSize] as const,
    enabled: enabled && pageSize > 0,
    staleTime: QueryStale.live,
    refetchInterval: 12_000,
    queryFn: async () => {
      const { data } = await restClient.get<{ games?: LiveGameRow[]; meta?: SkipPaginationMeta }>(
        "/games/live",
        { params: { skip: 0, limit: pageSize } },
      );
      return data.games ?? [];
    },
  });
}

export function liveGamesInfiniteQueryKey(limit: number, q = "") {
  return ["games", "live", "infinite", limit, q.trim()] as const;
}

/** Optional q matches game id or either player's username (server-side). */
export function useLiveGamesInfinite(limit: number, enabled = true, q = "") {
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: liveGamesInfiniteQueryKey(pageSize, needle),
    enabled: enabled && pageSize > 0,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite lists - refetching every page reshuffles/glitches scroll.
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        games?: LiveGameRow[];
        meta?: SkipPaginationMeta;
      }>("/games/live", {
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
      });
      return {
        games: data.games ?? [],
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.games?.length ?? 0),
  });
}
