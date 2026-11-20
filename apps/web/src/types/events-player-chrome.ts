import { parseListPageSize } from "@/lib/parse-list-page-size";

export type EventsPlayerChrome = {
  source?: string;
  events_player_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  empty_web?: string;
  detail_unavailable?: string;
  join_title?: string;
  join_blurb?: string;
  code_label?: string;
  code_placeholder?: string;
  join_action?: string;
  event_full?: string;
  event_not_joinable?: string;
  already_joined?: string;
  pending_approval?: string;
  approved_blurb?: string;
  rejected_blurb?: string;
  kicked_blurb?: string;
  spectate_action?: string;
  bracket_title?: string;
  winners_title?: string;
  share_result_action?: string;
  standings_title?: string;
  standings_played_label?: string;
  standings_wins_label?: string;
  standings_losses_label?: string;
  standings_points_label?: string;
  /** Template with `{n}` for group index (1-based). */
  group_label_template?: string;
  /** Template with `{n}` for Swiss round (1-based). */
  swiss_round_label_template?: string;
  result_card_share_image_action?: string;
  result_card_download_action?: string;
  result_card_filename?: string;
  result_card_title_font?: string;
  result_card_winners_font?: string;
  result_card_sponsor_font?: string;
  result_card_placement_font?: string;
  result_card_name_font?: string;
  result_card_header_wash_alpha?: string;
  result_card_width?: string;
  result_card_row_height?: string;
  result_card_header_height?: string;
  result_card_sponsor_height?: string;
  result_card_placements_max?: string;
  result_card_row_radius?: string;
  result_card_pad?: string;
  result_card_logo_size?: string;
  result_card_title_y?: string;
  result_card_winners_y?: string;
  result_card_body_gap?: string;
  result_card_rows_top_gap?: string;
  result_card_bottom_pad?: string;
  result_card_row_inset?: string;
  result_card_row_inner_gap?: string;
  result_card_placement_x?: string;
  result_card_name_x?: string;
  result_card_row_text_y?: string;
  result_card_sponsor_logo_w?: string;
  result_card_sponsor_logo_h?: string;
  result_card_sponsor_logo_gap?: string;
  result_card_logo_text_gap?: string;
  dialog_shell_max_height_ratio?: string;
  dialog_shell_max_width?: string;
  dialog_shell_inset_h?: string;
  dialog_shell_inset_v?: string;
  dialog_shell_loading_height?: string;
  branding_preview_height?: string;
  branding_preview_max_width?: string;
  dialog_scroll_max_height?: string;
  panel_max_width?: string;
  browse_max_width?: string;
  standings_table_min_width?: string;
  page_card_pad?: string;
  page_card_gap?: string;
  result_card_image_failed?: string;
  result_card_sponsor_prefix?: string;
  result_card_bg_color?: string;
  result_card_fg_color?: string;
  result_card_muted_color?: string;
  result_card_row_wash_color?: string;
  phase_group_label?: string;
  phase_knockout_label?: string;
  phase_swiss_label?: string;
  phase_round_robin_label?: string;
  feature_disabled?: string;
  /** Public community browse gate off (≠ empty list). */
  public_disabled?: string;
  insufficient_entry_fee?: string;
  top_up_action?: string;
  top_up_href?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  empty_value?: string;
  players_count_suffix?: string;
  amount_currency_separator?: string;
  meta_separator?: string;
  bracket_bye_label?: string;
  bracket_vs_label?: string;
  bracket_empty_seat?: string;
  load_failed?: string;
  report_action?: string;
  report_title?: string;
  report_reason_label?: string;
  report_note_label?: string;
  report_submit_action?: string;
  report_toast_sent?: string;
  report_toast_failed?: string;
  public_list_title?: string;
  public_list_blurb?: string;
  public_list_empty?: string;
  filter_all_label?: string;
  filter_free_label?: string;
  filter_paid_label?: string;
  filter_entry_label?: string;
  /** Discovery lifecycle CTAs (mig 441). */
  watch_action?: string;
  results_action?: string;
  lobby_action?: string;
  filter_lifecycle_label?: string;
  filter_lifecycle_open_label?: string;
  filter_lifecycle_live_label?: string;
  filter_lifecycle_finished_label?: string;
  filter_mine_label?: string;
  empty_lifecycle_open?: string;
  empty_lifecycle_live?: string;
  empty_lifecycle_finished?: string;
  empty_mine?: string;
  search_label?: string;
  search_placeholder?: string;
  /** Mobile/tablet: expand/collapse filter panel (tournaments parity). */
  filters_toggle_label?: string;
  filters_toggle_show_aria?: string;
  filters_toggle_hide_aria?: string;
  /** Debounce ms for list search (fail-closed positive int string). */
  search_debounce_ms?: string;
  hosted_by_label?: string;
  detail_description_label?: string;
  host_trust_badge_unverified?: string;
  host_trust_badge_phone_verified?: string;
  host_trust_badge_document_verified?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
  carousel_aria?: string;
  free_label?: string;
  players_label?: string;
  unlimited_players_label?: string;
  entry_label?: string;
  view_action?: string;
  share_action?: string;
  /** Toast after Share copies invite link (organizer copied_blurb parity). */
  copied_blurb?: string;
  toast_copy_failed?: string;
  detail_join_action?: string;
  join_code_section_title?: string;
  join_code_section_blurb?: string;
  roster_title?: string;
  format_label?: string;
  size_label?: string;
  visibility_private_blurb?: string;
  visibility_public_blurb?: string;
  /** Shown on public cups when catalog.public_event_matches_rated is true. */
  public_rated_on_blurb?: string;
  /** Shown on public cups when catalog.public_event_matches_rated is false. */
  public_rated_off_blurb?: string;
  entry_fee_pay_blurb?: string;
  dialog_close_label?: string;
  cancel_action?: string;
  prize_pool_now_label?: string;
  prize_pool_if_full_label?: string;
  prize_pool_guaranteed_label?: string;
  prize_pool_frozen_blurb?: string;
  prize_pool_entry_fees_note?: string;
  est_prize_share_label?: string;
  est_prize_share_blurb?: string;
  lobby_title?: string;
  lobby_blurb?: string;
  lobby_unavailable?: string;
  lobby_roster_title?: string;
  lobby_bracket_title?: string;
  lobby_standings_title?: string;
  lobby_next_match_title?: string;
  lobby_waiting_start?: string;
  lobby_open_play_action?: string;
  /** Optional: Live cup bracket with no unfinished boards yet. */
  lobby_no_live_boards?: string;
  /** Positive ms string from DB; bracket poll while cup lobby is open. */
  lobby_poll_interval_ms?: string;
  check_in_action?: string;
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
  prize_settled_blurb?: string;
  prize_pending_blurb?: string;
  dispute_window_blurb?: string;
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
  /** Hosted arena queue/leave API error chrome (mig 395); optional for hub ready. */
  toast_arena_queue_failed?: string;
  toast_arena_start_failed?: string;
  /** Player play/lobby writeEventsPlayerErr keys (optional; not hub-ready). */
  err_catalog_unavailable?: string;
  err_event_not_live?: string;
  err_event_not_found?: string;
  err_match_not_found?: string;
  err_match_not_ready?: string;
  err_players_missing?: string;
  qr_unavailable?: string;
  cannot_join_status?: string;
  err_start_failed?: string;
  err_start_game_failed?: string;
  err_unauthorized?: string;
};

const EVENTS_PLAYER_CHROME_KEYS: (keyof EventsPlayerChrome)[] = [
  "source",
  "events_player_chrome_unavailable",
  "page_title",
  "page_blurb",
  "empty_web",
  "detail_unavailable",
  "join_title",
  "join_blurb",
  "code_label",
  "code_placeholder",
  "join_action",
  "event_full",
  "event_not_joinable",
  "already_joined",
  "pending_approval",
  "approved_blurb",
  "rejected_blurb",
  "kicked_blurb",
  "spectate_action",
  "bracket_title",
  "winners_title",
  "share_result_action",
  "standings_title",
  "standings_played_label",
  "standings_wins_label",
  "standings_losses_label",
  "standings_points_label",
  "group_label_template",
  "swiss_round_label_template",
  "result_card_share_image_action",
  "result_card_download_action",
  "result_card_filename",
  "result_card_image_failed",
  "result_card_sponsor_prefix",
  "result_card_bg_color",
  "result_card_fg_color",
  "result_card_muted_color",
  "result_card_row_wash_color",
  "result_card_title_font",
  "result_card_winners_font",
  "result_card_sponsor_font",
  "result_card_placement_font",
  "result_card_name_font",
  "result_card_header_wash_alpha",
  "result_card_width",
  "result_card_row_height",
  "result_card_header_height",
  "result_card_sponsor_height",
  "result_card_placements_max",
  "result_card_row_radius",
  "result_card_pad",
  "result_card_logo_size",
  "result_card_title_y",
  "result_card_winners_y",
  "result_card_body_gap",
  "result_card_rows_top_gap",
  "result_card_bottom_pad",
  "result_card_row_inset",
  "result_card_row_inner_gap",
  "result_card_placement_x",
  "result_card_name_x",
  "result_card_row_text_y",
  "result_card_sponsor_logo_w",
  "result_card_sponsor_logo_h",
  "result_card_sponsor_logo_gap",
  "result_card_logo_text_gap",
  "dialog_shell_max_height_ratio",
  "dialog_shell_max_width",
  "dialog_shell_inset_h",
  "dialog_shell_inset_v",
  "dialog_shell_loading_height",
  "branding_preview_height",
  "branding_preview_max_width",
  "dialog_scroll_max_height",
  "panel_max_width",
  "browse_max_width",
  "standings_table_min_width",
  "page_card_pad",
  "page_card_gap",
  "phase_group_label",
  "phase_knockout_label",
  "phase_swiss_label",
  "phase_round_robin_label",
  "feature_disabled",
  "public_disabled",
  "insufficient_entry_fee",
  "top_up_action",
  "top_up_href",
  "list_page_size",
  "empty_value",
  "players_count_suffix",
  "amount_currency_separator",
  "meta_separator",
  "bracket_bye_label",
  "bracket_vs_label",
  "bracket_empty_seat",
  "load_failed",
  "report_action",
  "report_title",
  "report_reason_label",
  "report_note_label",
  "report_submit_action",
  "report_toast_sent",
  "report_toast_failed",
  "public_list_title",
  "public_list_blurb",
  "public_list_empty",
  "filter_all_label",
  "filter_free_label",
  "filter_paid_label",
  "filter_entry_label",
  "watch_action",
  "results_action",
  "lobby_action",
  "filter_lifecycle_label",
  "filter_lifecycle_open_label",
  "filter_lifecycle_live_label",
  "filter_lifecycle_finished_label",
  "filter_mine_label",
  "empty_lifecycle_open",
  "empty_lifecycle_live",
  "empty_lifecycle_finished",
  "empty_mine",
  "search_label",
  "search_placeholder",
  "filters_toggle_label",
  "filters_toggle_show_aria",
  "filters_toggle_hide_aria",
  "search_debounce_ms",
  "hosted_by_label",
  "detail_description_label",
  "host_trust_badge_unverified",
  "host_trust_badge_phone_verified",
  "host_trust_badge_document_verified",
  "host_rep_finished_label",
  "host_rep_cancelled_label",
  "host_rep_reports_label",
  "host_rep_meta_separator",
  "carousel_aria",
  "free_label",
  "players_label",
  "unlimited_players_label",
  "entry_label",
  "view_action",
  "share_action",
  // copied_blurb / toast_copy_failed: optional until migration 299; Share still copies.
  "detail_join_action",
  "join_code_section_title",
  "join_code_section_blurb",
  "roster_title",
  "format_label",
  "size_label",
  "visibility_private_blurb",
  "visibility_public_blurb",
  "public_rated_on_blurb",
  "public_rated_off_blurb",
  "entry_fee_pay_blurb",
  "dialog_close_label",
  "cancel_action",
  "prize_pool_now_label",
  "prize_pool_if_full_label",
  "prize_pool_guaranteed_label",
  "prize_pool_frozen_blurb",
  "prize_pool_entry_fees_note",
  "lobby_title",
  "lobby_blurb",
  "lobby_unavailable",
  "lobby_roster_title",
  "lobby_bracket_title",
  "lobby_standings_title",
  "lobby_next_match_title",
  "lobby_waiting_start",
  "lobby_open_play_action",
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
  "prize_settled_blurb",
  "prize_pending_blurb",
  "dispute_window_blurb",
  "toast_points_awarded_fmt",
];

const EVENTS_ARENA_LOBBY_CHROME_KEYS: (keyof EventsPlayerChrome)[] = [
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

const EVENTS_CUP_LOBBY_CHROME_KEYS: (keyof EventsPlayerChrome)[] = [
  "lobby_title",
  "lobby_blurb",
  "lobby_unavailable",
  "lobby_roster_title",
  "lobby_bracket_title",
  "lobby_standings_title",
  "lobby_next_match_title",
  "lobby_waiting_start",
  "lobby_open_play_action",
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
  "spectate_action",
  "est_prize_share_label",
  "est_prize_share_blurb",
];

const EVENTS_REPORT_CHROME_KEYS: (keyof EventsPlayerChrome)[] = [
  "report_action",
  "report_title",
  "report_reason_label",
  "report_note_label",
  "report_submit_action",
  "report_toast_sent",
  "report_toast_failed",
  "cancel_action",
];

/** Fail closed for event cup lobby report CTA and dialog. */
export function isEventsReportChromeReady(chrome: EventsPlayerChrome | null | undefined): boolean {
  if (!chrome) return false;
  return EVENTS_REPORT_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

/** Fail closed for event cup lobby panel (subset of events player chrome). */
export function isEventsCupLobbyChromeReady(
  chrome: EventsPlayerChrome | null | undefined,
): chrome is Required<Pick<EventsPlayerChrome, (typeof EVENTS_CUP_LOBBY_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  return EVENTS_CUP_LOBBY_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

export function isEventsArenaLobbyChromeKeysReady(
  chrome: EventsPlayerChrome | null | undefined,
): chrome is Required<Pick<EventsPlayerChrome, (typeof EVENTS_ARENA_LOBBY_CHROME_KEYS)[number]>> {
  if (!chrome) return false;
  return EVENTS_ARENA_LOBBY_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}

export function isEventsArenaLobbyChromeReady(
  chrome: EventsPlayerChrome | null | undefined,
): chrome is Required<
  Pick<
    EventsPlayerChrome,
    (typeof EVENTS_CUP_LOBBY_CHROME_KEYS)[number] | (typeof EVENTS_ARENA_LOBBY_CHROME_KEYS)[number]
  >
> {
  return isEventsCupLobbyChromeReady(chrome) && isEventsArenaLobbyChromeKeysReady(chrome);
}

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

export function isEventsPlayerChromeReady(
  chrome: EventsPlayerChrome | null | undefined,
): chrome is Required<EventsPlayerChrome> {
  if (!chrome) return false;
  if (!EVENTS_PLAYER_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]))) {
    return false;
  }
  // Fail closed: positive list_page_size (Flutter EventsPlayerChrome.isReady parity).
  if (parseListPageSize(chrome.list_page_size) < 1) return false;
  const debounce = Number.parseInt(String(chrome.search_debounce_ms || "").trim(), 10);
  if (!Number.isFinite(debounce) || debounce < 0) return false;
  return true;
}
