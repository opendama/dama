export type PlatformStatsChrome = {
  source?: string;
  platform_stats_unavailable?: string;
  section_title?: string;
  section_blurb?: string;
  period_label?: string;
  period_day_label?: string;
  period_week_label?: string;
  period_month_label?: string;
  period_year_label?: string;
  kpi_online_now?: string;
  kpi_playing_now?: string;
  kpi_users_total?: string;
  kpi_visited?: string;
  kpi_played?: string;
  kpi_games_finished?: string;
  kpi_dau?: string;
  kpi_wau?: string;
  kpi_mau?: string;
};

/**
 * Page-shell chrome only. Chart / heatmap / breakdown copy comes from
 * GET /public/platform-stats (fail-closed per section) - never block the whole
 * Status page when optional dashboard chrome is mid-migration.
 */
const PLATFORM_STATS_PAGE_CHROME_KEYS: (keyof PlatformStatsChrome)[] = [
  "source",
  "platform_stats_unavailable",
  "section_title",
  "section_blurb",
  "period_label",
  "period_day_label",
  "period_week_label",
  "period_month_label",
  "period_year_label",
  "kpi_online_now",
  "kpi_playing_now",
  "kpi_users_total",
  "kpi_visited",
  "kpi_played",
  "kpi_games_finished",
  "kpi_dau",
  "kpi_wau",
  "kpi_mau",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  return v.trim().length > 0;
}

export function isPlatformStatsChromeReady(
  chrome: PlatformStatsChrome | null | undefined,
): chrome is Required<PlatformStatsChrome> {
  if (!chrome) return false;
  return PLATFORM_STATS_PAGE_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
