import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export type PlayersSearchRow = {
  id: string;
  username: string;
  rating: number;
  xp: number;
  wins: number;
  losses: number;
  draws?: number;
  region?: string | null;
  country_code?: string | null;
  avatar_thumb_url?: string | null;
  avatar_full_url?: string | null;
  online?: boolean;
  playing?: boolean;
  playing_game_id?: string | null;
  level_label?: string | null;
  host_trust_tier?: string | null;
  host_trust_badge?: string | null;
};

/** `limit` must come from DB chrome (`list_page_size`) - never invent a default. */
export function usePlayersSearchQuery(q: string, skip = 0, limit = 0, enabled = true) {
  const pageSize = limit > 0 ? limit : 0;
  return useQuery({
    queryKey: ["players", "search", q, skip, pageSize] as const,
    enabled: enabled && pageSize > 0,
    staleTime: QueryStale.live,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await restClient.get<{
        players?: PlayersSearchRow[];
        meta?: SkipPaginationMeta;
      }>("/players", { params: { q: q.trim() || undefined, skip, limit: pageSize } });
      return {
        players: data.players ?? [],
        meta: data.meta,
      };
    },
    placeholderData: (prev) => prev,
  });
}

export function playersSearchInfiniteQueryKey(q: string, limit: number) {
  return ["players", "search", "infinite", q, limit] as const;
}

/** Trim-bell style infinite scroll for All Players. */
export function usePlayersSearchInfinite(q: string, limit: number, enabled = true) {
  const pageSize = limit > 0 ? limit : 0;
  return useInfiniteQuery({
    queryKey: playersSearchInfiniteQueryKey(q.trim(), pageSize),
    enabled: enabled && pageSize > 0,
    staleTime: QueryStale.live,
    // No refetchInterval on infinite lists - refetching every page reshuffles/glitches scroll.
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        players?: PlayersSearchRow[];
        meta?: SkipPaginationMeta;
      }>("/players", {
        params: { q: q.trim() || undefined, skip: pageParam, limit: pageSize },
      });
      return {
        players: data.players ?? [],
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.players?.length ?? 0),
  });
}
