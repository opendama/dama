"use client";

import { restClient } from "@/lib/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export type PlatformPeriodOption = { id: string; label: string };
export type PlatformKpiItem = { id: string; label: string; value: number };
export type PlatformKpiSection = { id: string; title: string; items: PlatformKpiItem[] };
export type PlatformSeriesMeta = { key: string; label: string; color_class: string };
export type PlatformSeriesPoint = { bucket: string; values: Record<string, number> };
export type PlatformHeatmapStat = { id: string; label: string; value: string };
export type PlatformBreakdownRow = { id: string; label: string; count: number };

export type PlatformStatsSnapshot = {
  period: string;
  default_period: string;
  online_now: number;
  playing_now: number;
  users_total: number;
  visited: number;
  played: number;
  games_finished: number;
  dau: number;
  wau: number;
  mau: number;
  periods: string[];
  period_options: PlatformPeriodOption[];
  kpi_sections: PlatformKpiSection[];
  series?: PlatformSeriesPoint[];
  series_meta?: PlatformSeriesMeta[];
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
  heatmap_stats?: PlatformHeatmapStat[];
  cumulative_title?: string;
  cumulative_empty?: string;
  cumulative_series_label?: string;
  breakdown_modes_title?: string;
  breakdown_modes_empty?: string;
  breakdown_modes?: PlatformBreakdownRow[];
  breakdown_outcomes_title?: string;
  breakdown_outcomes_empty?: string;
  breakdown_outcomes_meta?: string;
  breakdown_outcomes?: PlatformBreakdownRow[];
  breakdown_entry_title?: string;
  breakdown_entry_empty?: string;
  breakdown_entry?: PlatformBreakdownRow[];
};

export function usePlatformStatsChromeQuery(enabled = true) {
  return useQuery({
    queryKey: ["public", "platform-stats-chrome"],
    enabled,
    queryFn: async () => {
      const { data } = await restClient.get("/public/platform-stats-chrome");
      return data;
    },
    staleTime: 60_000,
  });
}

/**
 * period empty → API default_period.
 * keepPreviousData + session staleTime: period switches keep prior paint; revisiting a
 * period within 60s is cache-hit (no network flash). Trim useEventStats parity.
 */
export function usePlatformStatsQuery(enabled: boolean, period: string) {
  const p = (period || "").trim();
  return useQuery({
    queryKey: ["public", "platform-stats", p || "default"],
    enabled,
    queryFn: async (): Promise<PlatformStatsSnapshot> => {
      const { data } = await restClient.get<PlatformStatsSnapshot>("/public/platform-stats", {
        params: p ? { period: p } : undefined,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    // Background poll must not look like a period switch (bar uses isPlaceholderData only).
    refetchInterval: 30_000,
  });
}

const VISITOR_KEY = "dama_platform_visitor_key";

export function ensurePlatformVisitorKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let key = window.localStorage.getItem(VISITOR_KEY) || "";
    if (!key || key.length < 8) {
      if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
        return "";
      }
      key = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, key);
    }
    return key;
  } catch {
    return "";
  }
}

export async function postPlatformVisit(): Promise<void> {
  const visitor_key = ensurePlatformVisitorKey();
  if (!visitor_key) return;
  await restClient.post("/public/platform-stats/visit", { visitor_key });
}
