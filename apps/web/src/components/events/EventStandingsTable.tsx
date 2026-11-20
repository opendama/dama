"use client";

import { softCompetitionPointsLabel } from "@/lib/community-player-chrome-soft";
import type { HostedStandingRow } from "@/types/events";

export type EventStandingsChrome = {
  standings_title?: string;
  standings_played_label?: string;
  standings_wins_label?: string;
  standings_losses_label?: string;
  standings_points_label?: string;
  group_label_template?: string;
  empty_value?: string;
  standings_table_min_width?: string;
};

type Props = {
  standings: HostedStandingRow[];
  chrome: EventStandingsChrome;
  loading?: boolean;
};

function groupLabel(template: string | undefined, groupIndex: number): string {
  const t = (template || "").trim();
  if (!t || groupIndex < 0) return "";
  return t.replaceAll("{n}", String(groupIndex + 1));
}

/** Fail closed: hide when standings title or column labels missing. */
export function EventStandingsTable({ standings, chrome, loading }: Props) {
  const title = (chrome.standings_title || "").trim();
  const playedL = (chrome.standings_played_label || "").trim();
  const winsL = (chrome.standings_wins_label || "").trim();
  const lossesL = (chrome.standings_losses_label || "").trim();
  const pointsL = softCompetitionPointsLabel(chrome.standings_points_label);
  const empty = (chrome.empty_value || "").trim();
  const minW = Number((chrome.standings_table_min_width || "").trim());
  if (!title || !playedL || !winsL || !lossesL || !pointsL) return null;
  if (!Number.isFinite(minW) || minW <= 0) return null;

  const groups = Array.from(
    new Set(standings.map((r) => (typeof r.group_index === "number" ? r.group_index : -1))),
  ).sort((a, b) => a - b);
  const multiGroup = groups.filter((g) => g >= 0).length > 1;

  const renderRows = (rows: HostedStandingRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: minW }}>
        <thead>
          <tr className="text-[var(--dama-muted)]">
            <th className="px-2 py-1 font-medium" />
            <th className="px-2 py-1 font-medium" />
            <th className="px-2 py-1 font-medium tabular-nums">{playedL}</th>
            <th className="px-2 py-1 font-medium tabular-nums">{winsL}</th>
            <th className="px-2 py-1 font-medium tabular-nums">{lossesL}</th>
            <th className="px-2 py-1 font-medium tabular-nums">{pointsL}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className="border-t border-[var(--dama-border)]">
              <td className="px-2 py-1.5 tabular-nums text-[var(--dama-gold)]">
                {typeof r.placement === "number" ? r.placement : i + 1}
              </td>
              <td className="px-2 py-1.5">{(r.username || "").trim() || empty}</td>
              <td className="px-2 py-1.5 tabular-nums">{r.played}</td>
              <td className="px-2 py-1.5 tabular-nums">{r.wins}</td>
              <td className="px-2 py-1.5 tabular-nums">{r.losses}</td>
              <td className="px-2 py-1.5 tabular-nums font-medium text-[var(--dama-gold)]">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--dama-gold)]">{title}</h3>
      {loading ? <p className="text-sm text-[var(--dama-muted)]">{empty}</p> : null}
      {!loading && standings.length === 0 ? (
        <p className="text-sm text-[var(--dama-muted)]">{empty}</p>
      ) : null}
      {!loading && multiGroup
        ? groups
            .filter((g) => g >= 0)
            .map((gi) => {
              const rows = standings.filter(
                (r) => (typeof r.group_index === "number" ? r.group_index : -1) === gi,
              );
              const gl = groupLabel(chrome.group_label_template, gi);
              return (
                <div key={`g-${gi}`} className="space-y-1">
                  {gl ? <p className="text-xs font-medium text-[var(--dama-muted)]">{gl}</p> : null}
                  {renderRows(rows)}
                </div>
              );
            })
        : !loading && standings.length > 0
          ? renderRows(standings)
          : null}
    </div>
  );
}
