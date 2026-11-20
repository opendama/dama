export type TournamentsPlayerChrome = {
  source?: string;
  tournaments_player_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  empty?: string;
  empty_web?: string;
  /** Missing card-cell placeholder (never list-empty copy). */
  empty_value?: string;
  free_entry_prefix?: string;
  enroll_action?: string;
  enrolling_action?: string;
  join_action?: string;
  joining_action?: string;
  watch_action?: string;
  results_action?: string;
  lobby_action?: string;
  enroll_failed?: string;
  joined_free?: string;
  filter_all_label?: string;
  filter_free_label?: string;
  filter_paid_label?: string;
  filter_entry_label?: string;
  /** Official | Community | All (optional until chrome ready). */
  filter_source_label?: string;
  filter_source_all_label?: string;
  filter_source_official_label?: string;
  filter_source_community_label?: string;
  filter_lifecycle_label?: string;
  filter_lifecycle_open_label?: string;
  filter_lifecycle_live_label?: string;
  filter_lifecycle_finished_label?: string;
  filter_mine_label?: string;
  empty_lifecycle_open?: string;
  empty_lifecycle_live?: string;
  empty_lifecycle_finished?: string;
  empty_mine?: string;
  my_tournaments_title?: string;
  my_tournaments_empty?: string;
  my_tournaments_open_action?: string;
  my_tournaments_place_label?: string;
  my_tournaments_points_label?: string;
  my_tournaments_streak_label?: string;
  my_tournaments_prize_label?: string;
  badge_official_label?: string;
  badge_community_label?: string;
  host_tournament_action?: string;
  host_tournament_href?: string;
  host_tournament_blurb?: string;
  empty_community?: string;
  empty_official?: string;
  search_label?: string;
  search_placeholder?: string;
  /** Mobile/tablet: expand/collapse filter panel. */
  filters_toggle_label?: string;
  filters_toggle_show_aria?: string;
  filters_toggle_hide_aria?: string;
  /** Debounce ms for list search (fail-closed positive int string). */
  search_debounce_ms?: string;
  enrolled_charged_prefix?: string;
  enrolled_charged_close?: string;
  enrolled_bare?: string;
  load_failed?: string;
  meta_separator?: string;
  amount_currency_separator?: string;
  players_label?: string;
  unlimited_players_label?: string;
  prize_label?: string;
  entry_label?: string;
  free_label?: string;
  carousel_aria?: string;
  prize_pool_now_label?: string;
  prize_pool_if_full_label?: string;
  prize_pool_guaranteed_label?: string;
  prize_pool_frozen_blurb?: string;
  prize_pool_display_label?: string;
  prize_pool_entry_fees_note?: string;
  est_prize_share_label?: string;
  est_prize_share_blurb?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  lobby_title?: string;
  lobby_blurb?: string;
  lobby_unavailable?: string;
  lobby_roster_title?: string;
  lobby_bracket_title?: string;
  lobby_standings_title?: string;
  standings_title?: string;
  standings_played_label?: string;
  standings_wins_label?: string;
  standings_losses_label?: string;
  standings_points_label?: string;
  standings_table_min_width?: string;
  group_label_template?: string;
  lobby_next_match_title?: string;
  lobby_waiting_start?: string;
  lobby_open_play_action?: string;
  lobby_spectate_action?: string;
  /** Optional: Live cup bracket with no unfinished boards yet. */
  lobby_no_live_boards?: string;
  /** Positive ms string from DB; bracket poll while cup lobby is open. */
  lobby_poll_interval_ms?: string;
  check_in_action?: string;
  /** Optional DB blurb: check in before start or lose bracket seat. */
  check_in_required_blurb?: string;
  check_in_pending?: string;
  check_in_done?: string;
  check_in_closed?: string;
  check_in_not_open?: string;
  check_in_success?: string;
  ready_action?: string;
  ready_pending?: string;
  ready_done?: string;
  ready_waiting_opponent?: string;
  ready_success?: string;
  /** Optional DB blurb: ready-check no-show may forfeit. */
  ready_timeout_blurb?: string;
  format_label?: string;
  prize_settled_blurb?: string;
  prize_pending_blurb?: string;
  dispute_window_blurb?: string;
  report_action?: string;
  report_title?: string;
  report_reason_label?: string;
  report_note_label?: string;
  report_submit_action?: string;
  report_toast_sent?: string;
  report_toast_failed?: string;
  cancel_action?: string;
  arena_lobby_title?: string;
  arena_lobby_blurb?: string;
  arena_queue_action?: string;
  arena_queue_pending?: string;
  arena_queue_done?: string;
  arena_leave_queue_action?: string;
  arena_leave_queue_pending?: string;
  arena_clock_label?: string;
  arena_points_label?: string;
  arena_streak_label?: string;
  arena_standings_title?: string;
  arena_waiting_pair?: string;
  arena_finished_blurb?: string;
  arena_not_started_blurb?: string;
  arena_left_blurb?: string;
  toast_points_awarded_fmt?: string;
  /** Official arena queue/leave API errors (mig 396); optional for hub ready. */
  toast_arena_queue_failed?: string;
  toast_arena_start_failed?: string;
  /** Official play/lobby writeTournamentsPlayerErr keys (optional; not hub-ready). */
  err_bracket_failed?: string;
  err_check_in_not_open?: string;
  err_check_in_closed?: string;
  err_start_failed?: string;
  err_match_not_found?: string;
  err_match_not_ready?: string;
  err_players_missing?: string;
  err_not_enrolled?: string;
};

const TOURNAMENTS_PLAYER_CHROME_KEYS: (keyof TournamentsPlayerChrome)[] = [
  "source",
  "tournaments_player_chrome_unavailable",
  "page_title",
  "page_blurb",
  "empty",
  "empty_web",
  "empty_value",
  "empty_official",
  "empty_community",
  "free_entry_prefix",
  "enroll_action",
  "enrolling_action",
  "join_action",
  "joining_action",
  "watch_action",
  "results_action",
  "lobby_action",
  "enroll_failed",
  "joined_free",
  // Official | Community | All discovery (mig 376+) - fail closed, not soft UI-only.
  "filter_source_label",
  "filter_source_all_label",
  "filter_source_official_label",
  "filter_source_community_label",
  "filter_lifecycle_label",
  "filter_lifecycle_open_label",
  "filter_lifecycle_live_label",
  "filter_lifecycle_finished_label",
  "filter_mine_label",
  "empty_lifecycle_open",
  "empty_lifecycle_live",
  "empty_lifecycle_finished",
  "empty_mine",
  "my_tournaments_title",
  "my_tournaments_empty",
  "my_tournaments_open_action",
  "my_tournaments_place_label",
  "my_tournaments_points_label",
  "my_tournaments_streak_label",
  "my_tournaments_prize_label",
  "badge_official_label",
  "badge_community_label",
  "host_tournament_action",
  "host_tournament_href",
  "host_tournament_blurb",
  "filter_all_label",
  "filter_free_label",
  "filter_paid_label",
  "filter_entry_label",
  "search_label",
  "search_placeholder",
  "filters_toggle_label",
  "filters_toggle_show_aria",
  "filters_toggle_hide_aria",
  "search_debounce_ms",
  "enrolled_charged_prefix",
  "enrolled_charged_close",
  "enrolled_bare",
  "load_failed",
  "meta_separator",
  "amount_currency_separator",
  "players_label",
  "unlimited_players_label",
  "prize_label",
  "entry_label",
  "free_label",
  "carousel_aria",
  "prize_pool_now_label",
  "prize_pool_if_full_label",
  "prize_pool_guaranteed_label",
  "prize_pool_frozen_blurb",
  "prize_pool_display_label",
  "prize_pool_entry_fees_note",
  "list_page_size",
  "lobby_title",
  "lobby_blurb",
  "lobby_unavailable",
  "lobby_roster_title",
  "lobby_bracket_title",
  "lobby_standings_title",
  "lobby_next_match_title",
  "lobby_waiting_start",
  "lobby_open_play_action",
  "lobby_spectate_action",
  "lobby_poll_interval_ms",
  "standings_title",
  "standings_played_label",
  "standings_wins_label",
  "standings_losses_label",
  "standings_points_label",
  "standings_table_min_width",
  "group_label_template",
  "check_in_action",
  "check_in_pending",
  "check_in_done",
  "check_in_closed",
  "check_in_not_open",
  "check_in_success",
  "ready_action",
  "ready_pending",
  "ready_done",
  "ready_waiting_opponent",
  "ready_success",
  "format_label",
  "prize_settled_blurb",
  "prize_pending_blurb",
  "dispute_window_blurb",
  "toast_points_awarded_fmt",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

export function isTournamentsPlayerChromeReady(
  chrome: TournamentsPlayerChrome | null | undefined,
): chrome is Required<TournamentsPlayerChrome> {
  if (!chrome) return false;
  return TOURNAMENTS_PLAYER_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

const TOURNAMENT_ARENA_LOBBY_CHROME_KEYS: (keyof TournamentsPlayerChrome)[] = [
  "arena_lobby_title",
  "arena_lobby_blurb",
  "arena_queue_action",
  "arena_queue_pending",
  "arena_queue_done",
  "arena_leave_queue_action",
  "arena_leave_queue_pending",
  "arena_clock_label",
  "arena_points_label",
  "arena_streak_label",
  "arena_standings_title",
  "arena_waiting_pair",
  "arena_finished_blurb",
  "arena_not_started_blurb",
  "arena_left_blurb",
  "est_prize_share_label",
  "est_prize_share_blurb",
];

const TOURNAMENT_CUP_LOBBY_CHROME_KEYS: (keyof TournamentsPlayerChrome)[] = [
  "lobby_title",
  "lobby_blurb",
  "lobby_unavailable",
  "lobby_roster_title",
  "lobby_bracket_title",
  "lobby_standings_title",
  "lobby_next_match_title",
  "lobby_waiting_start",
  "lobby_open_play_action",
  "lobby_spectate_action",
  "lobby_poll_interval_ms",
  "check_in_action",
  "check_in_pending",
  "check_in_done",
  "check_in_closed",
  "check_in_not_open",
  "check_in_success",
  "ready_action",
  "ready_pending",
  "ready_done",
  "ready_waiting_opponent",
  "ready_success",
  "format_label",
  "prize_settled_blurb",
  "prize_pending_blurb",
  "dispute_window_blurb",
  "meta_separator",
  "empty_value",
  "load_failed",
  "players_label",
  "est_prize_share_label",
  "est_prize_share_blurb",
];

const TOURNAMENT_REPORT_CHROME_KEYS: (keyof TournamentsPlayerChrome)[] = [
  "report_action",
  "report_title",
  "report_reason_label",
  "report_note_label",
  "report_submit_action",
  "report_toast_sent",
  "report_toast_failed",
  "cancel_action",
];

/** Fail closed for cup lobby report CTA and dialog. */
export function isTournamentReportChromeReady(
  chrome: TournamentsPlayerChrome | null | undefined,
): boolean {
  if (!chrome) return false;
  return TOURNAMENT_REPORT_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

/** Fail closed for cup lobby panel (subset of player tournaments chrome). */
export function isTournamentCupLobbyChromeReady(
  chrome: TournamentsPlayerChrome | null | undefined,
): chrome is Required<
  Pick<TournamentsPlayerChrome, (typeof TOURNAMENT_CUP_LOBBY_CHROME_KEYS)[number]>
> {
  if (!chrome) return false;
  return TOURNAMENT_CUP_LOBBY_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

export function isTournamentArenaLobbyChromeKeysReady(
  chrome: TournamentsPlayerChrome | null | undefined,
): chrome is Required<
  Pick<TournamentsPlayerChrome, (typeof TOURNAMENT_ARENA_LOBBY_CHROME_KEYS)[number]>
> {
  if (!chrome) return false;
  return TOURNAMENT_ARENA_LOBBY_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

/** Base cup lobby chrome plus arena keys when format is arena. */
export function isTournamentArenaLobbyChromeReady(
  chrome: TournamentsPlayerChrome | null | undefined,
): chrome is Required<
  Pick<
    TournamentsPlayerChrome,
    | (typeof TOURNAMENT_CUP_LOBBY_CHROME_KEYS)[number]
    | (typeof TOURNAMENT_ARENA_LOBBY_CHROME_KEYS)[number]
  >
> {
  return isTournamentCupLobbyChromeReady(chrome) && isTournamentArenaLobbyChromeKeysReady(chrome);
}
