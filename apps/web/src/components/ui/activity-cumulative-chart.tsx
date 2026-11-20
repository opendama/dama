"use client";

import { ChartFloatTipPortal } from "@/components/ui/chart-float-tip-portal";
import { useChartFloatTip } from "@/hooks/use-sticky-chart-tip";
import { nearestIndexFromClientX } from "@/lib/chart-nearest-point";
import {
  damaChartTooltipStyle,
  formatBucketDayLabel,
  formatCompactNumber,
  useDamaChartTheme,
} from "@/lib/dama-chart-theme";
import { type PointerEvent as ReactPointerEvent, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

export type ActivityCumulativeSeriesPoint = {
  bucket: string;
  values: Record<string, number>;
};

type ChartRow = { day: string; day_label: string; total: number };

/** Matches AreaChart margin + YAxis width={44}. */
const PLOT_MARGIN = { top: 8, right: 8, bottom: 4, left: 44 };

function tipBody(theme: ReturnType<typeof useDamaChartTheme>, seriesLabel: string, row: ChartRow) {
  const title = (row.day_label || "").trim();
  const name = (seriesLabel || "").trim();
  const value = String(row.total ?? "");
  return (
    <div
      className="min-w-[10rem] rounded-lg border px-3 py-2 text-xs shadow-[var(--dama-card-shadow)]"
      style={damaChartTooltipStyle(theme)}
    >
      {title ? <p className="font-medium text-[var(--dama-text)]">{title}</p> : null}
      {name ? (
        <p className="mt-1 text-[var(--dama-muted)]">
          {name}: <span className="tabular-nums text-[var(--dama-text)]">{value}</span>
        </p>
      ) : null}
    </div>
  );
}

/** Running sum of series.values.games - Trim token-savings-chart parity. */
export function ActivityCumulativeChart({
  title,
  emptyLabel,
  seriesLabel,
  series,
  isFetching = false,
}: {
  title: string;
  emptyLabel: string;
  seriesLabel: string;
  series: ActivityCumulativeSeriesPoint[];
  isFetching?: boolean;
}) {
  const theme = useDamaChartTheme();
  const titleTrim = (title || "").trim();
  const empty = (emptyLabel || "").trim();
  const label = (seriesLabel || "").trim();
  const { tip, wrapRef, showAt, hoverAt, onFineLeave, isFinePointer } = useChartFloatTip();

  const data = useMemo((): ChartRow[] => {
    let run = 0;
    const daily: ChartRow[] = [];
    for (const row of series) {
      const day = (row.bucket || "").trim();
      const dayLabel = formatBucketDayLabel(day);
      if (!day || !dayLabel) continue;
      const games = row.values?.games;
      if (typeof games === "number" && Number.isFinite(games) && games > 0) {
        run += games;
      }
      daily.push({ day, day_label: dayLabel, total: run });
    }
    const maxPoints = 62;
    if (daily.length <= maxPoints) return daily;
    const stride = Math.ceil(daily.length / maxPoints);
    const out: ChartRow[] = [];
    for (let i = 0; i < daily.length; i += stride) {
      const last = daily[Math.min(i + stride, daily.length) - 1];
      if (last) out.push(last);
    }
    return out;
  }, [series]);

  const hasPlot = data.some((d) => d.total > 0);

  const tipAtPointer = (e: ReactPointerEvent<HTMLDivElement>, mode: "hover" | "tap") => {
    if (!theme.ready || !hasPlot || !wrapRef.current) return;
    const idx = nearestIndexFromClientX(wrapRef.current, e.clientX, data.length, PLOT_MARGIN);
    if (idx == null) {
      if (mode === "hover") onFineLeave();
      return;
    }
    const row = data[idx];
    if (!row) return;
    const body = tipBody(theme, label, row);
    if (mode === "hover") hoverAt(row.day, e.clientX, e.clientY, body);
    else showAt(row.day, e.clientX, e.clientY, body);
  };

  if (!titleTrim || !empty || !label) return null;

  return (
    <div className="space-y-4" aria-busy={isFetching || undefined}>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--dama-text)] sm:text-xl">
        {titleTrim}
      </h3>
      <div
        ref={wrapRef}
        className="relative h-52 w-full min-w-0 touch-manipulation sm:h-64 md:h-72"
        onPointerMove={(e) => {
          if (!isFinePointer() || e.pointerType !== "mouse") return;
          tipAtPointer(e, "hover");
        }}
        onPointerLeave={() => {
          if (isFinePointer()) onFineLeave();
        }}
        onPointerUp={(e) => {
          // Touch/pen always; mouse-only fine pointers use hover instead.
          if (e.pointerType === "mouse" && isFinePointer()) return;
          if (e.button !== 0 && e.pointerType === "mouse") return;
          tipAtPointer(e, "tap");
        }}
      >
        {theme.ready && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="damaCumulativeGames" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.muted} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={theme.muted} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day_label"
                tick={{ fill: theme.muted, fontSize: 10 }}
                stroke={theme.axisLine}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                height={28}
              />
              <YAxis
                tick={{ fill: theme.muted, fontSize: 10 }}
                stroke={theme.axisLine}
                tickLine={false}
                width={44}
                tickFormatter={formatCompactNumber}
                allowDecimals={false}
              />
              <Area
                type="monotone"
                dataKey="total"
                name={label}
                stroke={theme.fg}
                fill="url(#damaCumulativeGames)"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
        {!hasPlot && empty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="max-w-sm text-center text-sm text-[var(--dama-muted)]">{empty}</p>
          </div>
        ) : null}
        {/* Vertical guide under the open tip (touch + hover). */}
        {tip ? (
          <div
            className="pointer-events-none absolute bottom-7 top-2 w-px border-l border-dashed border-[var(--dama-muted)]"
            style={{ left: tip.x - (wrapRef.current?.getBoundingClientRect().left ?? 0) }}
            aria-hidden
          />
        ) : null}
        <ChartFloatTipPortal tip={tip} />
      </div>
    </div>
  );
}
