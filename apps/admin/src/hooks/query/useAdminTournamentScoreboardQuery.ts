import { authHeaders, restClient } from "@/lib/api";
import { QueryStale } from "@/lib/query-policy";
import { useQuery } from "@tanstack/react-query";

export type AdminScoreboardRow = {
  userId: string;
  username: string;
  points: number;
};

export function adminTournamentScoreboardQueryKey(
  tournamentId: string | null | undefined,
  mode: "standings" | "arena" | null,
) {
  return ["admin-tournament-scoreboard", tournamentId, mode] as const;
}

/** Live scoreboard for admin projected score-share (DB standings / arena points). */
export function useAdminTournamentScoreboardQuery(
  token: string | null | undefined,
  tournamentId: string | null | undefined,
  mode: "standings" | "arena" | null,
  enabled = true,
) {
  const id = (tournamentId || "").trim();
  return useQuery({
    staleTime: QueryStale.session,
    queryKey: adminTournamentScoreboardQueryKey(id, mode),
    enabled: enabled && Boolean(token) && Boolean(id) && Boolean(mode),
    queryFn: async (): Promise<AdminScoreboardRow[]> => {
      if (!token || !mode) throw new Error("");
      if (mode === "arena") {
        const { data } = await restClient.get<{
          standings?: Array<{
            user_id?: string;
            username?: string;
            arena_points?: number;
            points?: number;
          }>;
        }>(`/tournaments/${encodeURIComponent(id)}/arena/standings`, {
          headers: authHeaders(token),
        });
        const out: AdminScoreboardRow[] = [];
        for (const r of data.standings ?? []) {
          const uid = (r.user_id || "").trim();
          if (!uid) continue;
          const pts =
            typeof r.arena_points === "number" && Number.isFinite(r.arena_points)
              ? r.arena_points
              : typeof r.points === "number" && Number.isFinite(r.points)
                ? r.points
                : 0;
          if (pts <= 0) continue;
          out.push({
            userId: uid,
            username: (r.username || "").trim(),
            points: pts,
          });
        }
        return out;
      }
      const { data } = await restClient.get<{
        standings?: Array<{
          user_id?: string;
          username?: string;
          points?: number;
        }>;
      }>(`/tournaments/${encodeURIComponent(id)}/standings`, {
        headers: authHeaders(token),
      });
      const out: AdminScoreboardRow[] = [];
      for (const r of data.standings ?? []) {
        const uid = (r.user_id || "").trim();
        if (!uid) continue;
        const pts = typeof r.points === "number" && Number.isFinite(r.points) ? r.points : 0;
        if (pts <= 0) continue;
        out.push({
          userId: uid,
          username: (r.username || "").trim(),
          points: pts,
        });
      }
      return out;
    },
  });
}
