"use client";

import { restClient } from "@/lib/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type ActivitySeriesPoint = {
  bucket: string;
  values: Record<string, number>;
};

export type ActivityPeriodOption = { id: string; label: string };
export type ActivityKpiItem = { id: string; label: string; value: number };
export type ActivityKpiSection = { id: string; title: string; items: ActivityKpiItem[] };
export type ActivitySeriesMeta = { key: string; label: string; color_class: string };
export type ActivityHeatmapStat = { id: string; label: string; value: string };
export type ActivityBreakdownRow = { id: string; label: string; count: number };

export type ActivitySnapshot = {
  period: string;
  period_start: string;
  period_end: string;
  default_period: string;
  online_now: number;
  playing_now: number;
  users_total: number;
  new_users: number;
  visited: number;
  played: number;
  games_finished: number;
  dau: number;
  wau: number;
  mau: number;
  series: ActivitySeriesPoint[];
  periods: string[];
  period_options: ActivityPeriodOption[];
  kpi_sections: ActivityKpiSection[];
  series_meta: ActivitySeriesMeta[];
  series_title?: string;
  series_subtitle?: string;
  series_y_axis?: string;
  series_empty?: string;
  series_legend_aria?: string;
  series_today_label?: string;
  today_day?: string;
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

/** period empty → API uses activity_analytics.default_period (DB-driven). */
export function useAdminActivityQuery(
  token: string | null | undefined,
  enabled: boolean,
  period: string,
) {
  const p = (period || "").trim();
  return useQuery({
    queryKey: ["console", "activity", p || "default"],
    enabled: Boolean(token) && enabled,
    queryFn: async (): Promise<ActivitySnapshot> => {
      const { data } = await restClient.get<ActivitySnapshot>("/console/activity", {
        headers: { Authorization: `Bearer ${token}` },
        params: p ? { period: p } : undefined,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 30_000,
  });
}
