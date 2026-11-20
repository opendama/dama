"use client";

import { ChartFloatTipPortal } from "@/components/ui/chart-float-tip-portal";
import { ChartLegendList } from "@/components/ui/chart-legend";
import { useChartFloatTip } from "@/hooks/use-sticky-chart-tip";
import { nearestIndexFromClientX } from "@/lib/chart-nearest-point";
import {
  damaChartTooltipStyle,
  formatBucketDayLabel,
  formatCompactNumber,
  resolveSeriesColor,
  sharePct,
  useDamaChartTheme,
} from "@/lib/dama-chart-theme";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityChartSeriesMeta = {
  key: string;
  label: string;
  color_class: string;
};

export type ActivityChartPoint = {
  bucket: string;
  values: Record<string, number>;
};

type SeriesMeta = { id: string; label: string; color: string };
type ChartRow = {
  day: string;
  day_label: string;
  [k: string]: string | number;
};

/** Matches AreaChart margin + YAxis width={44}. */
const PLOT_MARGIN = { top: 12, right: 8, bottom: 4, left: 44 };

function stackedTipBody(
  theme: ReturnType<typeof useDamaChartTheme>,
  seriesMeta: SeriesMeta[],
  row: ChartRow,
): ReactNode {
  const dayLabel = (row.day_label || "").trim();
  if (!dayLabel) return null;
  const lines = seriesMeta
    .map((s) => {
      const raw = Number(row[`d_${s.id}`] ?? Number.NaN);
      return { ...s, raw };
    })
    .filter((s) => Number.isFinite(s.raw) && s.raw > 0)
    .sort((a, b) => b.raw - a.raw);
  if (!lines.length) return null;
  const dayTotal = lines.reduce((sum, s) => sum + s.raw, 0);
  return (
    <div
      className="max-h-[min(70vh,22rem)] min-w-[11rem] max-w-[min(92vw,20rem)] overflow-y-auto rounded-lg border px-3 py-2 text-xs shadow-[var(--dama-card-shadow)]"
      style={damaChartTooltipStyle(theme)}
    >
      <p className="font-medium text-[var(--dama-text)]">{dayLabel}</p>
      <ul className="mt-1.5 space-y-1">
        {lines.map((s) => {
          const pct = sharePct(s.raw, dayTotal);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-[var(--dama-muted)]">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate" title={s.label}>
                  {s.label}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums text-[var(--dama-text)]">
                <span>{s.raw.toLocaleString()}</span>
                {typeof pct === "number" ? (
                  <span className="w-11 text-right text-[var(--dama-muted)]">
                    {pct.toFixed(1)}%
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Trim UsageStackedChart parity for activity series.
 * Tips: nearest-day hit-test (Recharts activePayload is unreliable on touch).
 */
export function ActivityStackedChart({
  title,
  subtitle,
  yAxisLabel,
  series,
  seriesMeta,
  emptyLabel,
  legendAria,
  todayDay,
  todayLabel,
  isFetching = false,
}: {
  title: string;
  subtitle?: string;
  yAxisLabel?: string;
  series: ActivityChartPoint[];
  seriesMeta: ActivityChartSeriesMeta[];
  emptyLabel: string;
  legendAria: string;
  todayDay?: string;
  todayLabel?: string;
  isFetching?: boolean;
}) {
  const theme = useDamaChartTheme();
  const { tip, wrapRef, showAt, hoverAt, onFineLeave, isFinePointer } = useChartFloatTip();
  const aria = (legendAria || "").trim();
  const titleTrim = (title || "").trim();
  const subtitleTrim = (subtitle || "").trim();
  const yLabel = (yAxisLabel || "").trim();
  const today = (todayDay || "").trim();
  const todayLbl = (todayLabel || "").trim();
  const empty = (emptyLabel || "").trim();

  const meta: SeriesMeta[] = useMemo(() => {
    if (!theme.ready) return [];
    const out: SeriesMeta[] = [];
    for (const s of seriesMeta) {
      const id = (s.key || "").trim();
      const label = (s.label || "").trim();
      const color = resolveSeriesColor(s.color_class);
      if (!id || !label || !color) continue;
      out.push({ id, label, color });
    }
    return out;
  }, [seriesMeta, theme.ready]);

  const chartRows = useMemo((): ChartRow[] => {
    const maxPoints = 62;
    const daily: ChartRow[] = [];
    for (const row of series) {
      const day = (row.bucket || "").trim();
      const dayLabel = formatBucketDayLabel(day);
      if (!day || !dayLabel) continue;
      const point: ChartRow = {
        day,
        day_label: dayLabel,
        _z: 0,
      };
      const vals = row.values || {};
      for (const s of meta) {
        const v = vals[s.id];
        point[`d_${s.id}`] = typeof v === "number" && Number.isFinite(v) ? v : 0;
      }
      daily.push(point);
    }
    if (daily.length <= maxPoints) return daily;
    const stride = Math.ceil(daily.length / maxPoints);
    const out: ChartRow[] = [];
    for (let i = 0; i < daily.length; i += stride) {
      const chunk = daily.slice(i, i + stride);
      const first = chunk[0];
      if (!first) continue;
      const merged: ChartRow = {
        day: first.day,
        day_label: first.day_label,
        _z: 0,
      };
      for (const s of meta) {
        let sum = 0;
        for (const row of chunk) {
          sum += Number(row[`d_${s.id}`]) || 0;
        }
        merged[`d_${s.id}`] = sum;
      }
      out.push(merged);
    }
    return out;
  }, [series, meta]);

  const legendItems = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of chartRows) {
      for (const s of meta) {
        const v = Number(row[`d_${s.id}`]);
        if (!Number.isFinite(v)) continue;
        totals.set(s.id, (totals.get(s.id) || 0) + v);
      }
    }
    const period = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...meta]
      .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0))
      .map((s) => {
        const v = totals.get(s.id) || 0;
        return {
          id: s.id,
          label: s.label,
          color: s.color,
          value: v,
          valueLabel: v.toLocaleString(),
          pct: sharePct(v, period),
        };
      });
  }, [chartRows, meta]);

  const hasMeta = meta.length > 0;
  const hasAxis = chartRows.length > 0;
  const hasPlot = hasMeta && hasAxis;
  const showToday = Boolean(today && todayLbl) && chartRows.some((r) => r.day === today);
  const todayX = showToday ? chartRows.find((d) => d.day === today)?.day_label : undefined;

  const tipAtPointer = (e: ReactPointerEvent<HTMLDivElement>, mode: "hover" | "tap") => {
    if (!theme.ready || !hasPlot || !wrapRef.current) return;
    const idx = nearestIndexFromClientX(wrapRef.current, e.clientX, chartRows.length, PLOT_MARGIN);
    if (idx == null) {
      if (mode === "hover") onFineLeave();
      return;
    }
    const row = chartRows[idx];
    if (!row) return;
    const body = stackedTipBody(theme, meta, row);
    if (!body) return;
    if (mode === "hover") hoverAt(row.day, e.clientX, e.clientY, body);
    else showAt(row.day, e.clientX, e.clientY, body);
  };

  if (!titleTrim || !aria) return null;

  const guideLeft =
    tip && wrapRef.current ? tip.x - wrapRef.current.getBoundingClientRect().left : null;

  return (
    <div className="space-y-4" aria-busy={isFetching || undefined}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--dama-text)] sm:text-xl">
          {titleTrim}
        </h3>
        {subtitleTrim ? (
          <p className="mt-1 text-sm text-[var(--dama-muted)]">{subtitleTrim}</p>
        ) : null}
        {yLabel ? (
          <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--dama-muted)]">
            {yLabel}
          </p>
        ) : null}
      </div>

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
        {hasAxis ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
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
                domain={hasPlot ? [0, "auto"] : [0, 1]}
                allowDecimals={false}
                tickFormatter={formatCompactNumber}
              />
              {todayX ? (
                <ReferenceLine
                  x={todayX}
                  stroke={theme.subtle}
                  strokeDasharray="4 4"
                  label={{
                    value: todayLbl,
                    fill: theme.muted,
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              ) : null}
              {!hasPlot ? (
                <Area
                  type="monotone"
                  dataKey="_z"
                  stroke="transparent"
                  fill="transparent"
                  fillOpacity={0}
                  strokeWidth={0}
                  legendType="none"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ) : null}
              {meta.map((s) => (
                <Area
                  key={s.id}
                  type="monotone"
                  dataKey={`d_${s.id}`}
                  name={s.label}
                  stackId="activity"
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.5}
                  strokeWidth={1.25}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
        {!hasPlot && empty ? (
          <div className="pointer-events-none absolute inset-y-0 left-11 right-2 flex items-center justify-center px-2 sm:right-3 sm:px-4">
            <p className="w-full max-w-[16rem] text-center text-xs leading-relaxed text-[var(--dama-muted)] sm:max-w-sm sm:text-sm">
              {empty}
            </p>
          </div>
        ) : null}
        {guideLeft != null ? (
          <div
            className="pointer-events-none absolute bottom-7 top-3 w-px border-l border-dashed border-[var(--dama-muted)]"
            style={{ left: guideLeft }}
            aria-hidden
          />
        ) : null}
        <ChartFloatTipPortal tip={tip} />
      </div>

      {hasPlot ? (
        <ChartLegendList
          items={legendItems}
          ariaLabel={aria}
          maxHeightClass="max-h-36 sm:max-h-44"
        />
      ) : null}
    </div>
  );
}
