"use client";

import { ActivityBreakdownPanel } from "@/components/ui/activity-breakdown-panel";
import type { ActivityBreakdownRow } from "@/components/ui/activity-breakdown-panel";
import { ActivityCumulativeChart } from "@/components/ui/activity-cumulative-chart";
import type { ActivityCumulativeSeriesPoint } from "@/components/ui/activity-cumulative-chart";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import type { ActivityHeatmapStat } from "@/components/ui/activity-heatmap";

export type ActivityDashboardSnapshot = {
  series?: ActivityCumulativeSeriesPoint[];
  heatmap_title?: string;
  heatmap_empty?: string;
  heatmap_total_label?: string;
  heatmap_stats?: ActivityHeatmapStat[];
  cumulative_title?: string;
  cumulative_empty?: string;
  cumulative_series_label?: string;
  breakdown_modes_title?: string;
  breakdown_modes_empty?: string;
  breakdown_modes?: ActivityBreakdownRow[];
  breakdown_outcomes_title?: string;
  breakdown_outcomes_empty?: string;
  breakdown_outcomes_meta?: string;
  breakdown_outcomes?: ActivityBreakdownRow[];
  breakdown_entry_title?: string;
  breakdown_entry_empty?: string;
  breakdown_entry?: ActivityBreakdownRow[];
};

/** Trim CardContent overflow-visible: tips must escape the card (overflow-x-clip clips both axes). */
function cardClassName() {
  return "min-w-0 overflow-visible rounded-lg border border-[var(--dama-border)] bg-[var(--dama-card)] p-6 shadow-[var(--dama-card-shadow)]";
}

/** Trim dashboard order: heatmap → cumulative → 3 breakdown cards. */
export function ActivityDashboardSections({
  data,
  isFetching = false,
}: {
  data: ActivityDashboardSnapshot;
  isFetching?: boolean;
}) {
  const series = data.series ?? [];
  const heatmapTitle = (data.heatmap_title || "").trim();
  const heatmapEmpty = (data.heatmap_empty || "").trim();
  const heatmapTotal = (data.heatmap_total_label || "").trim();
  const heatmapStats = data.heatmap_stats ?? [];
  const showHeatmap =
    Boolean(heatmapTitle && heatmapEmpty && heatmapTotal && heatmapStats.length > 0) &&
    series.length > 0;

  const cumulativeTitle = (data.cumulative_title || "").trim();
  const cumulativeEmpty = (data.cumulative_empty || "").trim();
  const cumulativeLabel = (data.cumulative_series_label || "").trim();
  const showCumulative = Boolean(cumulativeTitle && cumulativeEmpty && cumulativeLabel);

  const modesTitle = (data.breakdown_modes_title || "").trim();
  const modesEmpty = (data.breakdown_modes_empty || "").trim();
  const showModes = Boolean(modesTitle && modesEmpty);

  const outcomesTitle = (data.breakdown_outcomes_title || "").trim();
  const outcomesEmpty = (data.breakdown_outcomes_empty || "").trim();
  const outcomesMeta = (data.breakdown_outcomes_meta || "").trim();
  const showOutcomes = Boolean(outcomesTitle && outcomesEmpty);

  const entryTitle = (data.breakdown_entry_title || "").trim();
  const entryEmpty = (data.breakdown_entry_empty || "").trim();
  const showEntry = Boolean(entryTitle && entryEmpty);

  if (!showHeatmap && !showCumulative && !showModes && !showOutcomes && !showEntry) {
    return null;
  }

  return (
    <div className="space-y-8">
      {showHeatmap ? (
        <div className={cardClassName()}>
          <ActivityHeatmap
            title={heatmapTitle}
            totalLabel={heatmapTotal}
            emptyLabel={heatmapEmpty}
            series={series}
            stats={heatmapStats}
            isFetching={isFetching}
          />
        </div>
      ) : null}

      {showCumulative ? (
        <div className={cardClassName()}>
          <ActivityCumulativeChart
            title={cumulativeTitle}
            emptyLabel={cumulativeEmpty}
            seriesLabel={cumulativeLabel}
            series={series}
            isFetching={isFetching}
          />
        </div>
      ) : null}

      {showModes || showOutcomes || showEntry ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {showModes ? (
            <div className={cardClassName()}>
              <ActivityBreakdownPanel
                title={modesTitle}
                emptyLabel={modesEmpty}
                variant="pie"
                rows={data.breakdown_modes ?? []}
                isFetching={isFetching}
              />
            </div>
          ) : null}
          {showOutcomes ? (
            <div className={cardClassName()}>
              <ActivityBreakdownPanel
                title={outcomesTitle}
                emptyLabel={outcomesEmpty}
                metaLine={outcomesMeta}
                variant="bar"
                rows={data.breakdown_outcomes ?? []}
                isFetching={isFetching}
              />
            </div>
          ) : null}
          {showEntry ? (
            <div className={cardClassName()}>
              <ActivityBreakdownPanel
                title={entryTitle}
                emptyLabel={entryEmpty}
                variant="pie"
                rows={data.breakdown_entry ?? []}
                isFetching={isFetching}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
