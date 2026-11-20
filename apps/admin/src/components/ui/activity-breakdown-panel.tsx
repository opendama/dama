"use client";

import { ChartFloatTipPortal } from "@/components/ui/chart-float-tip-portal";
import { ChartLegendList } from "@/components/ui/chart-legend";
import { useChartFloatTip } from "@/hooks/use-sticky-chart-tip";
import {
  chartOutcomeColors,
  chartPiePalette,
  damaChartTooltipStyle,
  formatCompactNumber,
  sharePct,
  useDamaChartTheme,
} from "@/lib/dama-chart-theme";
import { type ReactNode, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export type ActivityBreakdownRow = {
  id: string;
  label: string;
  count: number;
};

type PieSlice = {
  id: string;
  name: string;
  value: number;
  fill: string;
};

type BarRow = { name: string; count: number; fill: string; id: string };

function tipShell(theme: ReturnType<typeof useDamaChartTheme>, children: ReactNode): ReactNode {
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-[var(--dama-card-shadow)]"
      style={damaChartTooltipStyle(theme)}
    >
      {children}
    </div>
  );
}

function pieTipBody(
  theme: ReturnType<typeof useDamaChartTheme>,
  name: string,
  value: string,
  swatch: string,
) {
  return tipShell(
    theme,
    <p className="flex items-center gap-2 text-[var(--dama-text)]">
      {swatch ? (
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: swatch }} />
      ) : null}
      <span>{name}</span>
      <span className="ml-auto tabular-nums">{value}</span>
    </p>,
  );
}

function barTipBody(
  theme: ReturnType<typeof useDamaChartTheme>,
  name: string,
  value: string,
  swatch: string,
) {
  return tipShell(
    theme,
    <>
      <p className="font-medium text-[var(--dama-text)]">{name}</p>
      <p className="mt-1 flex items-center gap-2 text-[var(--dama-muted)]">
        {swatch ? (
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: swatch }} />
        ) : null}
        <span className="tabular-nums text-[var(--dama-text)]">{value}</span>
      </p>
    </>,
  );
}

function eventClient(e: unknown): { x: number; y: number } | null {
  if (!e || typeof e !== "object") return null;
  const ev = e as { clientX?: number; clientY?: number };
  if (!Number.isFinite(ev.clientX) || !Number.isFinite(ev.clientY)) return null;
  return { x: Number(ev.clientX), y: Number(ev.clientY) };
}

/** Trim model-breakdown (pie) / status-breakdown (bar) parity for activity slices. */
export function ActivityBreakdownPanel({
  title,
  emptyLabel,
  metaLine,
  variant,
  rows,
  isFetching = false,
}: {
  title: string;
  emptyLabel: string;
  metaLine?: string;
  variant: "pie" | "bar";
  rows: ActivityBreakdownRow[];
  isFetching?: boolean;
}) {
  const theme = useDamaChartTheme();
  const titleTrim = (title || "").trim();
  const empty = (emptyLabel || "").trim();
  const meta = (metaLine || "").trim();
  const { tip, wrapRef, showAt, hoverAt, tapAt, onFineLeave, isFinePointer } = useChartFloatTip();

  const normalized = useMemo(() => {
    return (rows || [])
      .map((r) => ({
        id: (r.id || "").trim(),
        label: (r.label || "").trim(),
        count: typeof r.count === "number" && Number.isFinite(r.count) ? r.count : 0,
      }))
      .filter((r) => r.id && r.label && r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const total = normalized.reduce((s, r) => s + r.count, 0);

  const pieData = useMemo((): PieSlice[] => {
    if (variant !== "pie" || !theme.ready) return [];
    const palette = chartPiePalette();
    return normalized.map((r, i) => ({
      id: r.id,
      name: r.label,
      value: r.count,
      fill: palette[i % palette.length] || theme.fg,
    }));
  }, [normalized, variant, theme.ready, theme.fg]);

  const barData = useMemo((): BarRow[] => {
    if (variant !== "bar" || !theme.ready) return [];
    const outcome = chartOutcomeColors();
    return normalized.map((r) => {
      let fill = theme.fg;
      if (r.id === "decisive") fill = outcome.success;
      else if (r.id === "draw") fill = outcome.error;
      return { id: r.id, name: r.label, count: r.count, fill };
    });
  }, [normalized, variant, theme.ready, theme.fg]);

  const legendItems = useMemo(() => {
    const palette = chartPiePalette();
    return normalized.map((r, i) => {
      const color =
        variant === "bar"
          ? barData.find((b) => b.id === r.id)?.fill || theme.fg
          : pieData.find((p) => p.id === r.id)?.fill || palette[i % palette.length] || theme.fg;
      return {
        id: r.id,
        label: r.label,
        color,
        value: r.count,
        valueLabel: r.count.toLocaleString(),
        pct: sharePct(r.count, total),
      };
    });
  }, [normalized, total, variant, barData, pieData, theme.fg]);

  if (!titleTrim || !empty) return null;

  return (
    <div className="space-y-3" aria-busy={isFetching || undefined}>
      <h3 className="text-base font-semibold tracking-tight text-[var(--dama-text)]">
        {titleTrim}
      </h3>
      {meta ? <p className="text-sm leading-relaxed text-[var(--dama-muted)]">{meta}</p> : null}
      {!total ? (
        <p className="py-10 text-center text-sm text-[var(--dama-muted)]">{empty}</p>
      ) : variant === "pie" ? (
        <div className="flex flex-col gap-4">
          <div
            ref={wrapRef}
            className="relative mx-auto h-44 w-full max-w-[16rem] touch-manipulation sm:h-48"
            onMouseLeave={onFineLeave}
          >
            {theme.ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="54%"
                    outerRadius="82%"
                    paddingAngle={pieData.length > 1 ? 2 : 0}
                    stroke={theme.popover}
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseEnter={(data, _i, e) => {
                      if (!isFinePointer() || !theme.ready) return;
                      const slice = data as PieSlice;
                      const pt = eventClient(e);
                      if (!pt || !slice?.id) return;
                      hoverAt(
                        slice.id,
                        pt.x,
                        pt.y,
                        pieTipBody(theme, slice.name, String(slice.value), slice.fill),
                      );
                    }}
                    onClick={(data, _i, e) => {
                      if (isFinePointer() || !theme.ready) return;
                      const slice = data as PieSlice;
                      const pt = eventClient(e);
                      if (!pt || !slice?.id) return;
                      // Stop native synthetic mouse chain from immediately clearing.
                      if (e && typeof e === "object" && "stopPropagation" in e) {
                        (e as { stopPropagation: () => void }).stopPropagation();
                      }
                      tapAt(
                        slice.id,
                        pt.x,
                        pt.y,
                        pieTipBody(theme, slice.name, String(slice.value), slice.fill),
                      );
                    }}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.id} fill={d.fill} className="cursor-pointer outline-none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : null}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="max-w-[5.5rem] truncate text-center text-base font-semibold tabular-nums tracking-tight text-[var(--dama-text)] sm:text-lg">
                {formatCompactNumber(total)}
              </span>
            </div>
            <ChartFloatTipPortal tip={tip} />
          </div>
          <ChartLegendList
            items={legendItems}
            ariaLabel={titleTrim}
            columns={1}
            maxHeightClass="max-h-32 sm:max-h-40"
          />
        </div>
      ) : (
        <div ref={wrapRef} className="space-y-3" onMouseLeave={onFineLeave}>
          <div className="flex flex-wrap gap-2 sm:hidden">
            {legendItems.map((b) => (
              <button
                key={b.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--dama-border)] bg-[var(--dama-panel)] px-2.5 py-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  const body = barTipBody(theme, b.label, b.valueLabel, b.color);
                  showAt(b.id, rect.left + rect.width / 2, rect.top, body);
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: b.color }}
                  aria-hidden
                />
                <span className="text-[var(--dama-muted)]">{b.label}</span>
                <span className="font-medium tabular-nums text-[var(--dama-text)]">
                  {b.valueLabel}
                </span>
              </button>
            ))}
          </div>
          <div className="relative h-48 w-full min-w-0 touch-manipulation sm:h-56 md:h-64">
            {theme.ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: theme.muted, fontSize: 11 }}
                    stroke={theme.axisLine}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: theme.muted, fontSize: 10 }}
                    stroke={theme.axisLine}
                    tickLine={false}
                    width={40}
                    tickFormatter={formatCompactNumber}
                  />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={72}
                    isAnimationActive={false}
                    onMouseEnter={(data, _i, e) => {
                      if (!isFinePointer() || !theme.ready) return;
                      const row = (data as { payload?: BarRow }).payload ?? (data as BarRow);
                      const pt = eventClient(e);
                      if (!pt || !row?.id) return;
                      hoverAt(
                        row.id,
                        pt.x,
                        pt.y,
                        barTipBody(theme, row.name, String(row.count), row.fill),
                      );
                    }}
                    onClick={(data, _i, e) => {
                      if (isFinePointer() || !theme.ready) return;
                      const row = (data as { payload?: BarRow }).payload ?? (data as BarRow);
                      const pt = eventClient(e);
                      if (!pt || !row?.id) return;
                      if (e && typeof e === "object" && "stopPropagation" in e) {
                        (e as { stopPropagation: () => void }).stopPropagation();
                      }
                      tapAt(
                        row.id,
                        pt.x,
                        pt.y,
                        barTipBody(theme, row.name, String(row.count), row.fill),
                      );
                    }}
                  >
                    {barData.map((b) => (
                      <Cell key={b.id} fill={b.fill} className="cursor-pointer outline-none" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <ChartLegendList
            items={legendItems}
            ariaLabel={titleTrim}
            columns={1}
            maxHeightClass="max-h-28"
          />
          <ChartFloatTipPortal tip={tip} />
        </div>
      )}
    </div>
  );
}
