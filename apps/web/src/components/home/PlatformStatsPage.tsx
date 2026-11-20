"use client";

import { ActivityDashboardSections } from "@/components/ui/activity-dashboard-sections";
import { ActivityStackedChart } from "@/components/ui/activity-stacked-chart";
import { FetchProgressBar } from "@/components/ui/fetch-progress";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlatformStatsPageSkeleton } from "@/components/ui/shimmer-skeletons";
import {
  postPlatformVisit,
  usePlatformStatsChromeQuery,
  usePlatformStatsQuery,
} from "@/hooks/query/usePlatformStatsQuery";
import { isPlatformStatsChromeReady } from "@/types/platform-stats-chrome";
import { useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useRef, useState } from "react";

/**
 * Dedicated public platform-stats page (left-rail / hamburger `/?view=status`).
 * Period changes: keepPreviousData + absolute progress + cache-seeded default period
 * so the page never remounts shimmer or shifts layout (Trim Usage filter parity).
 */
export function PlatformStatsPage() {
  const queryClient = useQueryClient();
  const chromeQuery = usePlatformStatsChromeQuery(true);
  const chrome = isPlatformStatsChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;
  // "" until first snapshot - then aligned to API period without a second network hop.
  const [period, setPeriod] = useState("");
  const seededPeriodKey = useRef(false);
  const statsQuery = usePlatformStatsQuery(Boolean(chrome), period);
  const periodOptions = statsQuery.data?.period_options ?? [];
  const selectPeriod =
    (period && periodOptions.some((o) => o.id === period) && period) ||
    (statsQuery.data?.period || "").trim() ||
    undefined;

  useEffect(() => {
    void postPlatformVisit().catch(() => undefined);
  }, []);

  // Align controlled Select with API default without refetch flicker:
  // copy "default" cache → explicit period key, then set state (cache hit, no network).
  useEffect(() => {
    if (seededPeriodKey.current || period) return;
    const snap = statsQuery.data;
    if (!snap || statsQuery.isPlaceholderData) return;
    const apiPeriod = (snap.period || "").trim();
    if (!apiPeriod) return;
    seededPeriodKey.current = true;
    queryClient.setQueryData(["public", "platform-stats", apiPeriod], snap);
    setPeriod(apiPeriod);
  }, [period, queryClient, statsQuery.data, statsQuery.isPlaceholderData]);

  // First paint only - never swap the whole page for shimmer on period refetch.
  const initialPending =
    chromeQuery.isPending || (Boolean(chrome) && statsQuery.isPending && !statsQuery.data);

  if (initialPending) {
    return <PlatformStatsPageSkeleton />;
  }

  if (!chrome) {
    // Fail closed: only DB chrome copy - never invent a client fallback string.
    const unavailable = (chromeQuery.data?.platform_stats_unavailable || "").trim();
    return unavailable ? (
      <p className="py-8 text-center text-sm text-[var(--dama-muted)]">{unavailable}</p>
    ) : null;
  }

  const data = statsQuery.data;
  const sections = data?.kpi_sections ?? [];
  const tiles = sections.flatMap((s) => s.items);
  const seriesTitle = (data?.series_title || "").trim();
  const seriesSubtitle = (data?.series_subtitle || "").trim();
  const seriesYAxis = (data?.series_y_axis || "").trim();
  const seriesEmpty = (data?.series_empty || "").trim();
  const seriesLegendAria = (data?.series_legend_aria || "").trim();
  const seriesToday = (data?.series_today_label || "").trim();
  const todayDay = (data?.today_day || "").trim();
  const showChart =
    Boolean(seriesTitle && seriesEmpty && seriesLegendAria) && (data?.series_meta?.length ?? 0) > 0;
  // Period-key placeholder only - never the 30s background poll.
  const softFetching = statsQuery.isFetching && statsQuery.isPlaceholderData;

  return (
    <div className="relative w-full space-y-8">
      <FetchProgressBar active={softFetching} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--dama-text)]">
            {chrome.section_title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--dama-muted)]">{chrome.section_blurb}</p>
        </div>
        {periodOptions.length ? (
          <div className="w-full max-w-xs shrink-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--dama-muted)]">
              {chrome.period_label}
            </p>
            <Select
              value={selectPeriod}
              onValueChange={(next) => {
                // Non-urgent: keep current paint until React commits the key change.
                startTransition(() => setPeriod(next));
              }}
            >
              <SelectTrigger aria-label={chrome.period_label}>
                <SelectValue placeholder={chrome.period_label} />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {statsQuery.isError && !data ? (
        <p className="text-sm text-[var(--dama-danger)]">{chrome.platform_stats_unavailable}</p>
      ) : null}

      {tiles.length ? (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 [grid-template-columns:repeat(auto-fill,minmax(8rem,1fr))] lg:gap-4"
          aria-busy={softFetching || undefined}
        >
          {tiles.map((t) => (
            <KpiCard key={t.id} label={t.label} value={Number(t.value).toLocaleString("en-US")} />
          ))}
        </div>
      ) : null}

      {showChart ? (
        <div className="relative min-w-0 overflow-visible rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]">
          <ActivityStackedChart
            title={seriesTitle}
            subtitle={seriesSubtitle}
            yAxisLabel={seriesYAxis}
            series={data?.series ?? []}
            seriesMeta={data?.series_meta ?? []}
            emptyLabel={seriesEmpty}
            legendAria={seriesLegendAria}
            todayDay={todayDay}
            todayLabel={seriesToday}
            isFetching={softFetching}
          />
        </div>
      ) : null}

      {data ? <ActivityDashboardSections data={data} isFetching={softFetching} /> : null}
    </div>
  );
}
