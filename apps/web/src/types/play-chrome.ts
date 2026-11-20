export type PlayChrome = {
  source?: string;
  page_title?: string;
  choose_mode_hint?: string;
  board_waiting?: string;
  setup_title?: string;
  pvp_blurb?: string;
  practice_blurb?: string;
  ai_depth_label?: string;
  depths_waiting?: string;
  depth_option_prefix?: string;
  play_computer_action?: string;
  practice_unavailable?: string;
  new_setup_action?: string;
  toast_computer_unavailable?: string;
  toast_difficulty_unavailable?: string;
  toast_practice_started?: string;
  toast_start_failed?: string;
  toast_load_failed?: string;
  toast_illegal_square?: string;
  toast_live_required?: string;
  toast_move_timeout?: string;
  toast_move_failed?: string;
  toast_live_error?: string;
  toast_clock_flag?: string;
  toast_clock_flag_failed?: string;
  you_won_on_time_message?: string;
  you_lost_on_time_message?: string;
  you_drew_on_time_message?: string;
  match_result_win_on_time_aria?: string;
  match_result_loss_on_time_aria?: string;
  match_result_draw_on_time_aria?: string;
  notif_result_win_on_time?: string;
  notif_result_loss_on_time?: string;
  notif_result_draw_on_time?: string;
  status_draw?: string;
  status_draw_reason_prefix?: string;
  status_draw_reason_open?: string;
  status_draw_reason_close?: string;
  status_p1_wins?: string;
  status_p2_wins?: string;
  status_multi_capture?: string;
  status_white_to_move?: string;
  status_black_to_move?: string;
  status_your_turn?: string;
  status_opponent_turn?: string;
  label_mode?: string;
  label_game?: string;
  label_moves?: string;
  label_halfmove?: string;
  label_rules?: string;
  label_pieces?: string;
  label_white?: string;
  label_black?: string;
  play_chrome_unavailable?: string;
  lobby_title?: string;
  lobby_modes_blurb?: string;
  find_1v1_action?: string;
  practice_depth_label?: string;
  practice_unavailable_short?: string;
  live_board_title?: string;
  match_clock_prefix?: string;
  status_prefix?: string;
  status_starting?: string;
  increment_suffix?: string;
  seat_meta_separator?: string;
  toast_options_load_failed?: string;
  status_matched?: string;
  status_ws_prefix?: string;
  status_synced_moves_prefix?: string;
  toast_ai_depth_required?: string;
  status_started?: string;
  toast_ws_connection_error?: string;
  paren_open?: string;
  paren_close?: string;
  increment_paren_open?: string;
  board_size_separator?: string;
  label_value_separator?: string;
  id_truncate_suffix?: string;
  /** Decimal string from DB - how many leading chars of game id to show. */
  id_truncate_chars?: string;
  piece_count_separator?: string;
  glyph_king?: string;
  glyph_man?: string;
  live_label?: string;
  history_label?: string;
  status_replay?: string;
  game_over_title?: string;
  you_won_message?: string;
  you_lost_message?: string;
  restart_action?: string;
  stop_game_action?: string;
  stop_game_confirm_title?: string;
  stop_game_confirm_description?: string;
  stop_game_confirm_cancel?: string;
  stop_game_confirm_confirm?: string;
  stop_game_pending?: string;
  stop_game_success?: string;
  stop_game_failed?: string;
  pause_game_action?: string;
  resume_game_action?: string;
  pause_game_pending?: string;
  resume_game_pending?: string;
  toast_paused?: string;
  toast_resumed?: string;
  toast_pause_failed?: string;
  toast_resume_failed?: string;
  toast_auto_resumed?: string;
  pause_disabled?: string;
  game_paused_blurb?: string;
  /** `{time}` → m:ss countdown while paused. */
  pause_remaining_fmt?: string;
  floating_resume_label?: string;
  floating_resume_aria?: string;
  nav_paused_label?: string;
  err_pause_disabled?: string;
  err_already_paused?: string;
  err_not_paused?: string;
  err_game_paused?: string;
  official_paused_blurb?: string;
  /** `{role}` `{name}` */
  official_paused_by_fmt?: string;
  /** `{reason}` */
  official_paused_reason_fmt?: string;
  /** `{note}` */
  official_paused_note_fmt?: string;
  /** `{role}` `{name}` */
  official_resumed_toast_fmt?: string;
  err_officially_paused?: string;
  pause_kind_player?: string;
  pause_kind_official?: string;
  /** Board cover aria while paused (player or official). */
  pause_overlay_aria?: string;
  /** Official pause footer when there is no auto-resume. */
  pause_overlay_until_resume?: string;
  /** `{role}` `{name}` for player-initiated pause. */
  player_paused_by_fmt?: string;
  /** Seat player role label for pause overlay by-line (DB play_chrome). */
  role_player_label?: string;
  captures_your_label?: string;
  captures_opponent_label?: string;
  practice_start_pending?: string;
  /** Optional until migration 079 hydrates; BottomNav falls back when absent. */
  nav_continue_label?: string;
  nav_playing_label?: string;
  history_skip_first?: string;
  history_skip_prev?: string;
  history_skip_next?: string;
  history_skip_last?: string;
  history_skip_go?: string;
  history_skip_page_of?: string;
  match_intro_vs_label?: string;
  match_intro_duration_ms?: string;
  match_intro_aria?: string;
  match_intro_starting_label?: string;
  match_result_duration_ms?: string;
  match_result_win_aria?: string;
  match_result_loss_aria?: string;
  match_result_draw_aria?: string;
  toast_points_awarded_fmt?: string;
};

const PLAY_CHROME_KEYS: (keyof PlayChrome)[] = [
  "source",
  "page_title",
  "choose_mode_hint",
  "board_waiting",
  "setup_title",
  "pvp_blurb",
  "practice_blurb",
  "ai_depth_label",
  "depths_waiting",
  "depth_option_prefix",
  "play_computer_action",
  "practice_unavailable",
  "new_setup_action",
  "toast_computer_unavailable",
  "toast_difficulty_unavailable",
  "toast_practice_started",
  "toast_start_failed",
  "toast_load_failed",
  "toast_illegal_square",
  "toast_live_required",
  "toast_move_timeout",
  "toast_move_failed",
  "toast_clock_flag",
  "toast_clock_flag_failed",
  "you_won_on_time_message",
  "you_lost_on_time_message",
  "you_drew_on_time_message",
  "match_result_win_on_time_aria",
  "match_result_loss_on_time_aria",
  "match_result_draw_on_time_aria",
  "notif_result_win_on_time",
  "notif_result_loss_on_time",
  "notif_result_draw_on_time",
  "toast_live_error",
  "status_draw",
  "status_draw_reason_prefix",
  "status_draw_reason_open",
  "status_draw_reason_close",
  "status_p1_wins",
  "status_p2_wins",
  "status_multi_capture",
  "status_white_to_move",
  "status_black_to_move",
  "status_your_turn",
  "status_opponent_turn",
  "label_mode",
  "label_game",
  "label_moves",
  "label_halfmove",
  "label_rules",
  "label_pieces",
  "label_white",
  "label_black",
  "play_chrome_unavailable",
  "lobby_title",
  "lobby_modes_blurb",
  "find_1v1_action",
  "practice_depth_label",
  "practice_unavailable_short",
  "live_board_title",
  "match_clock_prefix",
  "status_prefix",
  "status_starting",
  "increment_suffix",
  "seat_meta_separator",
  "toast_options_load_failed",
  "status_matched",
  "status_ws_prefix",
  "status_synced_moves_prefix",
  "toast_ai_depth_required",
  "status_started",
  "toast_ws_connection_error",
  "paren_open",
  "paren_close",
  "increment_paren_open",
  "board_size_separator",
  "label_value_separator",
  "id_truncate_suffix",
  "id_truncate_chars",
  "piece_count_separator",
  "glyph_king",
  "glyph_man",
  "live_label",
  "history_label",
  "status_replay",
  "game_over_title",
  "you_won_message",
  "you_lost_message",
  "restart_action",
  "stop_game_action",
  "stop_game_confirm_title",
  "stop_game_confirm_description",
  "stop_game_confirm_cancel",
  "stop_game_confirm_confirm",
  "stop_game_pending",
  "stop_game_success",
  "pause_game_action",
  "resume_game_action",
  "pause_game_pending",
  "resume_game_pending",
  "toast_paused",
  "toast_resumed",
  "toast_pause_failed",
  "toast_resume_failed",
  "toast_auto_resumed",
  "pause_disabled",
  "game_paused_blurb",
  "pause_remaining_fmt",
  "floating_resume_label",
  "floating_resume_aria",
  "nav_paused_label",
  "err_pause_disabled",
  "err_already_paused",
  "err_not_paused",
  "err_game_paused",
  "official_paused_blurb",
  "official_paused_by_fmt",
  "official_paused_reason_fmt",
  "official_paused_note_fmt",
  "official_resumed_toast_fmt",
  "err_officially_paused",
  "pause_kind_player",
  "pause_kind_official",
  "pause_overlay_aria",
  "pause_overlay_until_resume",
  "player_paused_by_fmt",
  "role_player_label",
  "captures_your_label",
  "captures_opponent_label",
  "practice_start_pending",
  "match_intro_vs_label",
  "match_intro_duration_ms",
  "match_intro_aria",
  "toast_points_awarded_fmt",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every play chrome string must be present from the database. */
export function isPlayChromeReady(
  chrome: PlayChrome | null | undefined,
): chrome is Required<PlayChrome> {
  if (!chrome) return false;
  return PLAY_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
