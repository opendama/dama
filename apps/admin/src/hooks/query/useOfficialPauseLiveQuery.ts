"use client";

import { useQuery } from "@tanstack/react-query";
import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { requireApiSkipMeta } from "@/lib/skip-pagination";

export type OfficialPauseLiveGame = {
  id: string;
  paused?: boolean;
  pause_kind?: string;
  pause_reason_key?: string;
  pause_reason_label?: string;
  pause_note?: string;
  pause_actor_role?: string;
  pause_actor_display_name?: string;
  paused_at_unix_ms?: number;
  player1_username?: string;
  player2_username?: string;
  clock_p1_remaining_ms?: number;
  clock_p2_remaining_ms?: number;
  tournament_id?: string;
  event_id?: string;
  round_index?: number;
  match_index?: number;
  source?: string;
  last_action?: string;
  last_action_at?: string;
};

export type OfficialPauseLiveResponse = {
  games: OfficialPauseLiveGame[];
  officially_paused_count: number;
  meta: SkipPaginationMeta;
};

export function officialPauseLiveQueryKey(
  officialOnly: boolean,
  q: string,
  skip: number,
  limit: number,
) {
  return ["console", "official-pause-live", officialOnly, q, skip, limit] as const;
}

export function useOfficialPauseLiveQuery(
  token: string | null | undefined,
  enabled: boolean,
  opts: { officialOnly: boolean; q?: string; skip?: number; limit?: number },
) {
  const officialOnly = Boolean(opts.officialOnly);
  const q = (opts.q || "").trim();
  const skip = opts.skip ?? 0;
  const limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : 0;
  return useQuery({
    queryKey: officialPauseLiveQueryKey(officialOnly, q, skip, limit),
    enabled: Boolean(token) && enabled && limit > 0,
    staleTime: QueryStale.live,
    refetchInterval: 5_000,
    queryFn: async (): Promise<OfficialPauseLiveResponse> => {
      if (!token) throw new Error("");
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(limit));
      if (officialOnly) params.set("official_only", "1");
      if (q) params.set("q", q);
      const { data } = await restClient.get<OfficialPauseLiveResponse>(
        `/console/official-pause/live?${params.toString()}`,
        { headers: authHeaders(token) },
      );
      requireApiSkipMeta(data?.meta, "official pause live meta");
      if (!Array.isArray(data.games)) {
        throw new Error("official pause live games unavailable");
      }
      if (typeof data.officially_paused_count !== "number") {
        throw new Error("official pause live officially_paused_count unavailable");
      }
      return {
        games: data.games,
        meta: data.meta,
        officially_paused_count: data.officially_paused_count,
      };
    },
  });
}
