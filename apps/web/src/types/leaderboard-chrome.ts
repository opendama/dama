export type LeaderboardChrome = {
  source?: string;
  leaderboard_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  empty?: string;
  load_failed?: string;
  online_label?: string;
  playing_label?: string;
  offline_label?: string;
  inspect_aria_prefix?: string;
  wins_abbr?: string;
  losses_abbr?: string;
  draws_abbr?: string;
  stats_separator?: string;
  meta_separator?: string;
  rank_prefix?: string;
  xp_suffix?: string;
  hall_of_fame_title?: string;
  period_week?: string;
  period_month?: string;
  period_year?: string;
  period_all?: string;
  /** API period key: week | month | year | all (DB-driven; never client invent). */
  default_period?: string;
  /** Positive decimal string for skip/limit page size. */
  list_page_size?: string;
  pts_suffix?: string;
  your_rank_prefix?: string;
  view_full_leaderboard?: string;
  podium_first_aria?: string;
  podium_second_aria?: string;
  podium_third_aria?: string;
  rank_list_title?: string;
  unranked_label?: string;
  podium_first_crown?: string;
  podium_second_crown?: string;
  podium_third_crown?: string;
};

const LEADERBOARD_CHROME_KEYS: (keyof LeaderboardChrome)[] = [
  "source",
  "leaderboard_chrome_unavailable",
  "page_title",
  "page_blurb",
  "empty",
  "load_failed",
  "online_label",
  "playing_label",
  "offline_label",
  "inspect_aria_prefix",
  "wins_abbr",
  "losses_abbr",
  "draws_abbr",
  "stats_separator",
  "meta_separator",
  "rank_prefix",
  "xp_suffix",
  "hall_of_fame_title",
  "period_week",
  "period_month",
  "period_year",
  "period_all",
  "default_period",
  "list_page_size",
  "pts_suffix",
  "your_rank_prefix",
  "view_full_leaderboard",
  "podium_first_aria",
  "podium_second_aria",
  "podium_third_aria",
  "rank_list_title",
  "unranked_label",
  "podium_first_crown",
  "podium_second_crown",
  "podium_third_crown",
];

export function isLeaderboardChromeReady(
  chrome: LeaderboardChrome | null | undefined,
): chrome is Required<LeaderboardChrome> {
  if (!chrome) return false;
  return LEADERBOARD_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
