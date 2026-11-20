import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { restClient } from "@/lib/api";
import { nextSkipFromMeta } from "@/lib/infinite-page-param";
import { QueryStale } from "@/lib/query-policy";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export type MyMatchRow = {
  id: string;
  /** Live Redis game id - required to open / resume / review. */
  game_id?: string | null;
  mode?: string;
  player1_id?: string;
  player2_id?: string;
  winner_id?: string | null;
  is_draw?: boolean;
  move_count?: number;
  is_free?: boolean;
  finished_at?: string;
};

/** Legacy single page - prefer useMyMatchesInfinite for rail history.
 * `limit` must come from DB chrome (`list_page_size`) - never invent a default. */
export function useMyMatchesQuery(token: string | null | undefined, limit = 0) {
  const pageSize = limit > 0 ? limit : 0;
  return useQuery({
    queryKey: ["matches", "me", token ?? "", pageSize] as const,
    enabled: Boolean(token) && pageSize > 0,
    staleTime: QueryStale.session,
    queryFn: async () => {
      const { data } = await restClient.get<{ matches?: MyMatchRow[] }>("/matches/me", {
        params: { skip: 0, limit: pageSize },
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.matches ?? [];
    },
  });
}

/** Profile recent-matches skip/go page (backend meta from pagination_chrome). */
export function useMyMatchesPagedQuery(
  token: string | null | undefined,
  skip: number,
  limit: number,
  enabled = true,
) {
  const pageSize = limit > 0 ? limit : 0;
  return useQuery({
    queryKey: ["matches", "me", "paged", token ?? "", skip, pageSize] as const,
    enabled: Boolean(token) && pageSize > 0 && enabled,
    staleTime: QueryStale.session,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data } = await restClient.get<{
        matches?: MyMatchRow[];
        meta?: SkipPaginationMeta;
      }>("/matches/me", {
        params: { skip, limit: pageSize },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        matches: data.matches ?? [],
        meta: data.meta ?? null,
      };
    },
  });
}

export function myMatchesInfiniteQueryKey(token: string | null | undefined, limit: number, q = "") {
  return ["matches", "me", "infinite", token ?? "", limit, q.trim()] as const;
}

/** Optional q matches opponent username or game id (server-side). */
export function useMyMatchesInfinite(
  token: string | null | undefined,
  limit: number,
  enabled = true,
  q = "",
) {
  const pageSize = limit > 0 ? limit : 0;
  const needle = q.trim();
  return useInfiniteQuery({
    queryKey: myMatchesInfiniteQueryKey(token, pageSize, needle),
    enabled: Boolean(token) && pageSize > 0 && enabled,
    staleTime: QueryStale.session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await restClient.get<{
        matches?: MyMatchRow[];
        meta?: SkipPaginationMeta;
      }>("/matches/me", {
        params: { skip: pageParam, limit: pageSize, q: needle || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        matches: data.matches ?? [],
        meta: data.meta,
      };
    },
    getNextPageParam: (last) => nextSkipFromMeta(last.meta, last.matches?.length ?? 0),
  });
}
