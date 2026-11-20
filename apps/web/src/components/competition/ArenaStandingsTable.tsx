"use client";

import {
  softCompetitionArenaStandingsTitle,
  softCompetitionArenaStreakLabel,
  softCompetitionPointsLabel,
} from "@/lib/community-player-chrome-soft";
import type { ArenaStandingRow } from "@/types/tournament";

export type ArenaStandingsChrome = {
  arena_standings_title?: string;
  arena_points_label?: string;
  arena_streak_label?: string;
  empty_value?: string;
  standings_table_min_width?: string;
};

type Props = {
  standings: ArenaStandingRow[];
  chrome: ArenaStandingsChrome;
  loading?: boolean;
};

export function ArenaStandingsTable({ standings, chrome, loading }: Props) {
  const title = softCompetitionArenaStandingsTitle(chrome.arena_standings_title);
  const pointsL = softCompetitionPointsLabel(chrome.arena_points_label);
  const streakL = softCompetitionArenaStreakLabel(chrome.arena_streak_label);
  const empty = (chrome.empty_value || "").trim();
  const minW = Number((chrome.standings_table_min_width || "").trim());
  if (!title || !pointsL || !streakL) return null;
  if (!Number.isFinite(minW) || minW <= 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--dama-gold)]">{title}</h3>
      {loading && standings.length === 0 ? (
        <p className="text-sm text-[var(--dama-muted)]">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth: minW }}>
            <thead>
              <tr className="text-[var(--dama-muted)]">
                <th className="px-2 py-1 font-medium" />
                <th className="px-2 py-1 font-medium" />
                <th className="px-2 py-1 font-medium tabular-nums">{pointsL}</th>
                <th className="px-2 py-1 font-medium tabular-nums">{streakL}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => (
                <tr key={r.user_id} className="border-t border-[var(--dama-border)]">
                  <td className="px-2 py-1.5 tabular-nums text-[var(--dama-gold)]">
                    {typeof r.placement === "number" ? r.placement : i + 1}
                  </td>
                  <td className="px-2 py-1.5">{(r.username || "").trim() || empty}</td>
                  <td className="px-2 py-1.5 tabular-nums font-medium text-[var(--dama-gold)]">
                    {r.arena_points}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{r.arena_streak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
