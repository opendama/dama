export type ProfileInspectChrome = {
  source?: string;
  profile_inspect_chrome_unavailable?: string;
  load_failed?: string;
  sr_description?: string;
  inspect_action?: string;
  zoom_title?: string;
  no_avatar?: string;
  avatar_alt_suffix?: string;
  label_rating?: string;
  label_xp?: string;
  label_level?: string;
  label_wins?: string;
  label_losses?: string;
  label_draws?: string;
  label_country?: string;
  label_region?: string;
  label_regional_rank?: string;
  top_prefix?: string;
  recent_matches_title?: string;
  no_matches?: string;
  tournament_placements_title?: string;
  no_placements?: string;
  outcome_draw?: string;
  outcome_win?: string;
  outcome_loss?: string;
  free_suffix?: string;
  pieces_left_suffix?: string;
  captured_suffix?: string;
  seat_meta_separator?: string;
  stats_separator?: string;
  label_value_separator?: string;
  flag_code_separator?: string;
  rank_parts_separator?: string;
  page_title?: string;
  zoom_hint?: string;
  wld_label?: string;
  moves_suffix?: string;
  player_unavailable?: string;
  friends_count_label?: string;
  online_now_label?: string;
  offline_now_label?: string;
  playing_now_label?: string;
  overview_tab?: string;
  games_tab?: string;
  game_history_players_col?: string;
  game_history_result_col?: string;
  game_history_moves_col?: string;
  game_history_date_col?: string;
  friends_section_title?: string;
  joined_label?: string;
  no_friends?: string;
  empty_value?: string;
  /** Backend page size for recent matches / placements skip lists. */
  list_page_size?: string;
  host_trust_badge_unverified?: string;
  host_trust_badge_phone_verified?: string;
  host_trust_badge_document_verified?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
};

const PROFILE_INSPECT_CHROME_KEYS: (keyof ProfileInspectChrome)[] = [
  "source",
  "profile_inspect_chrome_unavailable",
  "load_failed",
  "sr_description",
  "inspect_action",
  "zoom_title",
  "no_avatar",
  "avatar_alt_suffix",
  "label_rating",
  "label_xp",
  "label_level",
  "label_wins",
  "label_losses",
  "label_draws",
  "label_country",
  "label_region",
  "label_regional_rank",
  "top_prefix",
  "recent_matches_title",
  "no_matches",
  "tournament_placements_title",
  "no_placements",
  "outcome_draw",
  "outcome_win",
  "outcome_loss",
  "free_suffix",
  "pieces_left_suffix",
  "captured_suffix",
  "seat_meta_separator",
  "stats_separator",
  "label_value_separator",
  "flag_code_separator",
  "rank_parts_separator",
  "page_title",
  "zoom_hint",
  "wld_label",
  "moves_suffix",
  "player_unavailable",
  "friends_count_label",
  "online_now_label",
  "offline_now_label",
  "playing_now_label",
  "overview_tab",
  "games_tab",
  "game_history_players_col",
  "game_history_result_col",
  "game_history_moves_col",
  "game_history_date_col",
  "friends_section_title",
  "joined_label",
  "no_friends",
  "empty_value",
  "list_page_size",
  "host_trust_badge_unverified",
  "host_trust_badge_phone_verified",
  "host_trust_badge_document_verified",
  "host_rep_finished_label",
  "host_rep_cancelled_label",
  "host_rep_reports_label",
  "host_rep_meta_separator",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every profile inspect chrome string must be present from the database. */
export function isProfileInspectChromeReady(
  chrome: ProfileInspectChrome | null | undefined,
): chrome is Required<ProfileInspectChrome> {
  if (!chrome) return false;
  return PROFILE_INSPECT_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
