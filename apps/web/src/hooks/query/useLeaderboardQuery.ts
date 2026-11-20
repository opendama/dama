import type { SkipPaginationMeta } from "@/components/ui/skip-pagination";
import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useAuthStore } from "@/store/auth";
import type { LeaderboardPlayer } from "@/types/player";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type { LeaderboardPlayer } from "@/types/player";

export type LeaderboardPeriod = "week" | "month" | "year" | "all";

export type LeaderboardListResponse = {
  leaderboard: Array<{
    id: string;
    username: string;
    rating: number;
    xp: number;
    wins: number;
    losses: number;
    draws: number;
    points?: number;
    region?: string | null;
    country_code?: string | null;
    avatar_thumb_url?: string | null;
    avatar_full_url?: string | null;
    online?: boolean;
    playing?: boolean;
    playing_game_id?: string | null;
    level_label?: string | null;
    regional_rank?: number | null;
    host_trust_tier?: string | null;
    host_trust_badge?: string | null;
  }>;
  meta: SkipPaginationMeta;
  period?: string;
  me?: { rank: number; period_wins: number; points: number } | null;
};

/** Auth-identity scoped so account switch never soft-serves prior Your Rank. */
export function leaderboardQueryKey(
  skip: number,
  limit: number,
  period: LeaderboardPeriod,
  authKey = "",
) {
  return ["leaderboard", skip, limit, period, authKey || "anon"] as const;
}

export type LeaderboardRailPlayer = LeaderboardPlayer & {
  playing?: boolean;
  playingGameId?: string | null;
  points?: number;
};

function mapRow(e: LeaderboardListResponse["leaderboard"][number]): LeaderboardRailPlayer {
  return {
    id: e.id,
    username: e.username,
    rating: e.rating,
    xp: e.xp,
    wins: e.wins,
    losses: e.losses,
    draws: e.draws,
    points: typeof e.points === "number" ? e.points : undefined,
    region: e.region ?? undefined,
    countryCode: e.country_code ?? undefined,
    avatarThumbUrl: e.avatar_thumb_url ?? undefined,
    avatarFullUrl: e.avatar_full_url ?? undefined,
    online: Boolean(e.online),
    playing: Boolean(e.playing),
    playingGameId: e.playing_game_id ?? null,
    levelLabel: e.level_label ?? undefined,
    regionalRank: e.regional_rank ?? undefined,
    hostTrustTier: e.host_trust_tier ?? null,
    hostTrustBadge: e.host_trust_badge ?? null,
  };
}

/** Parse DB chrome `default_period` - fail-closed (never invent week/all). */
export function parseLeaderboardPeriod(raw: string | null | undefined): LeaderboardPeriod | null {
  const p = (raw || "").trim().toLowerCase();
  if (p === "week" || p === "month" || p === "year" || p === "all") return p;
  return null;
}

/** Parse DB chrome `list_page_size` - fail-closed (never invent 20). */
export function parseLeaderboardPageSize(raw: string | null | undefined): number {
  const n = Number.parseInt((raw || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Trim skip/limit REST leaderboard with Hall of Fame period (caller supplies DB chrome values). */
export function useLeaderboardQuery(
  skip: number,
  limit: number,
  period: LeaderboardPeriod,
  enabled = true,
) {
  const token = useAuthStore((s) => s.token);
  const authKey = (token || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    enabled: enabled && limit > 0 && Boolean(period),
    queryKey: leaderboardQueryKey(skip, limit, period, authKey),
    queryFn: async () => {
      const { data } = await restClient.get<LeaderboardListResponse>("/leaderboard", {
        params: { skip, limit, period },
        headers: authHeaders(token),
      });
      const echoed = (data.period as string | undefined)?.trim();
      if (echoed !== period) {
        throw new Error(`leaderboard period mismatch (want ${period}, got ${echoed || "none"})`);
      }
      return {
        players: (data.leaderboard ?? []).map(mapRow),
        meta: data.meta,
        period: period,
        me: data.me ?? null,
      };
    },
    // Period tabs: keep prior paint (Status/Trim parity). Score labels use data.period
    // while soft-fetching so pts/rating never mismatch the rows on screen.
    placeholderData: keepPreviousData,
  });
}
