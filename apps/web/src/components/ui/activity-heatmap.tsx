"use client";

import { ViewportFloatTip } from "@/components/ui/chart-float-tip-portal";
import { formatBucketDayLabel, formatBucketMonthLabel } from "@/lib/dama-chart-theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ActivityHeatmapSeriesPoint = {
  bucket: string;
  values: Record<string, number>;
};

export type ActivityHeatmapStat = {
  id: string;
  label: string;
  value: string;
};

const INTENSITY_CLASS = [
  "bg-[var(--dama-panel)] border border-[var(--dama-border)]",
  "bg-[color-mix(in_srgb,var(--dama-gold)_22%,var(--dama-panel))]",
  "bg-[color-mix(in_srgb,var(--dama-gold)_40%,var(--dama-panel))]",
  "bg-[color-mix(in_srgb,var(--dama-gold)_62%,var(--dama-panel))]",
  "bg-[color-mix(in_srgb,var(--dama-gold)_82%,var(--dama-panel))] border border-[var(--dama-gold)]/40",
];

const CELL = 11;
const GAP = 3;

function dayIntensityValue(values: Record<string, number> | undefined): number {
  const v = values || {};
  return Math.max(v.visited ?? 0, v.played ?? 0, v.games ?? 0);
}

function intensityLevel(value: number, max: number): number {
  if (!(value > 0)) return 0;
  if (!(max > 0)) return 1;
  const ratio = value / max;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

function formatMonthLabel(ym: string): string {
  const raw = (ym || "").trim();
  if (raw.length < 7) return raw;
  return formatBucketMonthLabel(raw.slice(0, 7)) || raw;
}

function formatHeatmapStatDisplay(stat: ActivityHeatmapStat, activeDays: number): string {
  const fallback = (stat.value || "").trim();
  if (!fallback) return "";
  if (stat.id === "peak_day") {
    return formatBucketDayLabel(fallback) || fallback;
  }
  if (stat.id === "peak_month") {
    return formatMonthLabel(fallback) || fallback;
  }
  if (stat.id === "longest_streak" || stat.id === "current_streak") {
    return fallback;
  }
  if (stat.id === "active_days") {
    return String(activeDays);
  }
  return fallback;
}

function isFinePointer(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Trim loc-heatmap parity: calendar grid + active-day total + streak/peak stats.
 * Desktop: hover tip. Mobile/tablet: tap tip; tap outside dismisses (Trim sticky + outside close).
 */
export function ActivityHeatmap({
  title,
  totalLabel,
  emptyLabel,
  series,
  stats,
  isFetching = false,
}: {
  title: string;
  totalLabel: string;
  emptyLabel: string;
  series: ActivityHeatmapSeriesPoint[];
  stats: ActivityHeatmapStat[];
  isFetching?: boolean;
}) {
  const titleTrim = (title || "").trim();
  const totalLbl = (totalLabel || "").trim();
  const empty = (emptyLabel || "").trim();
  const statRows = (stats || []).filter((s) => s.id?.trim() && s.label?.trim() && s.value?.trim());
  const gridRef = useRef<HTMLDivElement>(null);

  const cells = useMemo(() => {
    const out: { day: string; value: number; level: number }[] = [];
    let max = 0;
    for (const row of series) {
      const day = (row.bucket || "").trim();
      if (!day) continue;
      const value = dayIntensityValue(row.values);
      if (value > max) max = value;
      out.push({ day, value, level: 0 });
    }
    for (const c of out) {
      c.level = intensityLevel(c.value, max);
    }
    return out;
  }, [series]);

  const calendar = useMemo(() => {
    const emptyCal = {
      weeks: [] as ({ day: string; value: number; level: number } | null)[][],
      monthLabels: [] as string[],
    };
    if (cells.length === 0) return emptyCal;
    const first = cells[0]?.day?.trim() || "";
    if (!first) return emptyCal;
    const wd = new Date(`${first}T00:00:00Z`).getUTCDay();
    const mon0 = (wd + 6) % 7;
    const flat: ({ day: string; value: number; level: number } | null)[] = [];
    for (let i = 0; i < mon0; i++) flat.push(null);
    for (const d of cells) flat.push(d);
    while (flat.length % 7 !== 0) flat.push(null);

    const weekCount = flat.length / 7;
    const weeks: ({ day: string; value: number; level: number } | null)[][] = [];
    const monthLabels: string[] = [];
    let prevYm = "";
    for (let w = 0; w < weekCount; w++) {
      const col: ({ day: string; value: number; level: number } | null)[] = [];
      let month = "";
      let weekYm = "";
      for (let r = 0; r < 7; r++) {
        const cell = flat[w * 7 + r] ?? null;
        col.push(cell);
        const day = cell?.day?.trim() || "";
        if (!weekYm && day.length >= 7) weekYm = day.slice(0, 7);
      }
      if (weekYm && weekYm !== prevYm) {
        month = formatMonthLabel(weekYm).slice(0, 3);
        prevYm = weekYm;
      }
      weeks.push(col);
      monthLabels.push(month);
    }
    return { weeks, monthLabels };
  }, [cells]);

  const [hover, setHover] = useState<{ text: string; x: number; y: number; day: string } | null>(
    null,
  );

  const openTip = useCallback((el: HTMLElement, text: string, day: string) => {
    const rect = el.getBoundingClientRect();
    setHover({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
      day,
    });
  }, []);

  useEffect(() => {
    if (!hover) return;
    const onDown = (e: PointerEvent) => {
      const root = gridRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setHover(null);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [hover]);

  if (!titleTrim || !totalLbl || !empty || cells.length === 0 || statRows.length === 0) {
    return null;
  }

  const activeDays = cells.filter((c) => c.value > 0).length;
  const weekCols = calendar.weeks.length;
  const gridWidth = weekCols * CELL + Math.max(0, weekCols - 1) * GAP;

  return (
    <div className="space-y-4" aria-busy={isFetching || undefined}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-[var(--dama-text)] sm:text-lg">
          {titleTrim}
        </h3>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--dama-muted)]">
          {totalLbl}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--dama-text)] sm:text-4xl">
          {activeDays.toLocaleString("en-US")}
        </p>
      </div>

      <div ref={gridRef} className="relative overflow-x-auto pb-1">
        <div className="inline-block min-w-0" style={{ width: gridWidth }}>
          {calendar.monthLabels.some((m) => m) ? (
            <div
              className="mb-1 grid"
              style={{
                gridTemplateColumns: `repeat(${weekCols}, ${CELL}px)`,
                columnGap: `${GAP}px`,
              }}
            >
              {calendar.monthLabels.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static month header slots never reorder
                <div key={`m-${i}`} className="text-[10px] leading-none text-[var(--dama-muted)]">
                  {i === 0 || m !== calendar.monthLabels[i - 1] ? m || "" : ""}
                </div>
              ))}
            </div>
          ) : null}
          <div
            className="grid"
            style={{
              width: gridWidth,
              gridTemplateColumns: `repeat(${weekCols}, ${CELL}px)`,
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gap: `${GAP}px`,
              gridAutoFlow: "column",
            }}
          >
            {calendar.weeks
              .flatMap((col, wi) =>
                col.map((d, ri) => ({
                  d,
                  key: d?.day ? d.day : `pad-${wi}-${ri}`,
                })),
              )
              .map(({ d, key }) => {
                if (!d) {
                  return <div key={key} className="rounded-sm bg-transparent" />;
                }
                const level = d.level;
                const dateLabel = formatBucketDayLabel(d.day) || d.day;
                // Trim-style tip: date + activity count when active.
                const tip =
                  dateLabel && d.value > 0
                    ? `${dateLabel}\n${d.value.toLocaleString("en-US")}`
                    : dateLabel || "";
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={tip || dateLabel}
                    className={`cursor-pointer rounded-sm touch-manipulation ${
                      INTENSITY_CLASS[level] || INTENSITY_CLASS[0]
                    } ${hover?.day === d.day ? "ring-1 ring-[var(--dama-text)]" : ""}`}
                    onMouseEnter={(e) => {
                      if (!isFinePointer() || !tip) return;
                      openTip(e.currentTarget, tip, d.day);
                    }}
                    onMouseLeave={() => {
                      if (isFinePointer()) setHover(null);
                    }}
                    onClick={(e) => {
                      // Mobile/tablet: tap toggles sticky tip (Trim mouseEnter-on-tap parity).
                      if (isFinePointer() || !tip) return;
                      e.preventDefault();
                      if (hover?.day === d.day) {
                        setHover(null);
                        return;
                      }
                      openTip(e.currentTarget, tip, d.day);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (!tip) return;
                      if (hover?.day === d.day) {
                        setHover(null);
                        return;
                      }
                      openTip(e.currentTarget, tip, d.day);
                    }}
                  />
                );
              })}
          </div>
        </div>
        {hover ? (
          <ViewportFloatTip
            key={hover.day}
            x={hover.x}
            y={hover.y}
            className="pointer-events-none fixed z-[100] max-w-[min(92vw,16rem)] whitespace-pre-line rounded-md border border-[var(--dama-border)] bg-[var(--dama-card)] px-2 py-1 text-xs text-[var(--dama-text)] shadow-[var(--dama-card-shadow)]"
          >
            {hover.text}
          </ViewportFloatTip>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-[var(--dama-border)] pt-4 sm:grid-cols-4">
        {statRows.map((s) => (
          <div key={s.id} className="min-w-0">
            <p className="text-[11px] text-[var(--dama-muted)]">{s.label}</p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--dama-text)]">
              {formatHeatmapStatDisplay(s, activeDays)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
