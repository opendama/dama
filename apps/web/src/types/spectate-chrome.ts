export type SpectateChrome = {
  source?: string;
  spectate_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  page_blurb_web?: string;
  game_id_required?: string;
  game_id_label?: string;
  game_id_placeholder?: string;
  waiting_game_state?: string;
  enter_game_prompt?: string;
  unable_to_spectate?: string;
  load_game_failed?: string;
  start_action?: string;
  connect_action?: string;
  listening_action?: string;
  disconnect_action?: string;
  connect_title?: string;
  waiting_board?: string;
  board_after_connect?: string;
  board_after_connect_web?: string;
  connecting_status?: string;
  disconnected_status?: string;
  status_draw?: string;
  status_draw_reason_prefix?: string;
  status_draw_reason_open?: string;
  status_draw_reason_close?: string;
  status_p1_wins?: string;
  status_p2_wins?: string;
  status_p1_wins_on_time?: string;
  status_p2_wins_on_time?: string;
  status_draw_on_time?: string;
  status_white_to_move?: string;
  status_black_to_move?: string;
  event_log_title?: string;
  no_events?: string;
  status_live_moves_prefix?: string;
  glyph_king?: string;
  glyph_man?: string;
  live_label?: string;
  history_label?: string;
  status_replay?: string;
  seat_meta_separator?: string;
  status_your_turn?: string;
  status_opponent_turn?: string;
  label_white?: string;
  label_black?: string;
  vote_section_title?: string;
  vote_pick_action?: string;
  vote_locked_label?: string;
  vote_sign_in?: string;
  vote_unavailable?: string;
  vote_cast_failed?: string;
  vote_casting_pending?: string;
  vote_percent_suffix?: string;
  vote_count_suffix?: string;
  vote_correct_title?: string;
  vote_correct_empty?: string;
  vote_correct_blurb?: string;
  vote_meta_separator?: string;
  viewers_overflow_prefix?: string;
  vote_players_cannot?: string;
  country_flag_image_url_template?: string;
  watch_tab_moves?: string;
  watch_tab_chat?: string;
  watch_tab_info?: string;
  /** Leave Moves/Chat/Info focus; restore overview vote/share. */
  watch_panel_back_action?: string;
  watch_panel_back_aria?: string;
  /** Compact vote chip score glue, e.g. en-dash between tallies. */
  vote_score_separator?: string;
  observing_game_label?: string;
  chat_disabled_label?: string;
  chat_enabled_label?: string;
  chat_disable_action?: string;
  chat_enable_action?: string;
  chat_disable_pending?: string;
  chat_enable_pending?: string;
  chat_input_placeholder?: string;
  chat_send_action?: string;
  chat_sending?: string;
  chat_reply_action?: string;
  chat_reply_cancel?: string;
  chat_attach_image_aria?: string;
  chat_empty?: string;
  chat_image_only_hint?: string;
  chat_toast_disabled?: string;
  chat_toast_send_failed?: string;
  chat_toast_toggle_failed?: string;
  chat_emoji_aria?: string;
  chat_join_required_label?: string;
  chat_load_failed_label?: string;
  chat_emoji_search_placeholder?: string;
  chat_emoji_search_empty?: string;
  chat_emoji_results_prefix?: string;
  chat_react_action?: string;
  chat_react_more_aria?: string;
  chat_you_label?: string;
  chat_reply_label?: string;
  chat_receipt_sent_aria?: string;
  chat_receipt_seen_aria?: string;
  chat_receipt_delivered_aria?: string;
  chat_receipt_pending_aria?: string;
  chat_receipt_failed_aria?: string;
  chat_receipt_retry_action?: string;
  chat_seen_by_prefix?: string;
  chat_image_fallback_label?: string;
  chat_receipt_sent_glyph?: string;
  chat_receipt_read_glyph?: string;
  chat_receipt_delivered_glyph?: string;
  chat_receipt_pending_glyph?: string;
  chat_receipt_failed_glyph?: string;
  chat_seen_count_glyph?: string;
  chat_media_lightbox_title?: string;
  chat_media_lightbox_close_aria?: string;
  chat_date_today?: string;
  chat_date_yesterday?: string;
  match_intro_vs_label?: string;
  match_intro_duration_ms?: string;
  match_intro_aria?: string;
};

const SPECTATE_CHROME_KEYS: (keyof SpectateChrome)[] = [
  "source",
  "spectate_chrome_unavailable",
  "page_title",
  "page_blurb",
  "page_blurb_web",
  "game_id_required",
  "game_id_label",
  "game_id_placeholder",
  "waiting_game_state",
  "enter_game_prompt",
  "unable_to_spectate",
  "load_game_failed",
  "start_action",
  "connect_action",
  "listening_action",
  "disconnect_action",
  "connect_title",
  "waiting_board",
  "board_after_connect",
  "board_after_connect_web",
  "connecting_status",
  "disconnected_status",
  "status_draw",
  "status_draw_reason_prefix",
  "status_draw_reason_open",
  "status_draw_reason_close",
  "status_p1_wins",
  "status_p2_wins",
  "status_p1_wins_on_time",
  "status_p2_wins_on_time",
  "status_draw_on_time",
  "status_white_to_move",
  "status_black_to_move",
  "event_log_title",
  "no_events",
  "status_live_moves_prefix",
  "glyph_king",
  "glyph_man",
  "live_label",
  "history_label",
  "status_replay",
  "seat_meta_separator",
  "status_your_turn",
  "status_opponent_turn",
  "label_white",
  "label_black",
  "vote_section_title",
  "vote_pick_action",
  "vote_locked_label",
  "vote_sign_in",
  "vote_unavailable",
  "vote_cast_failed",
  "vote_casting_pending",
  "vote_percent_suffix",
  "vote_count_suffix",
  "vote_correct_title",
  "vote_correct_empty",
  "vote_correct_blurb",
  "vote_meta_separator",
  "viewers_overflow_prefix",
  "vote_players_cannot",
  "country_flag_image_url_template",
  "watch_tab_moves",
  "watch_tab_chat",
  "watch_tab_info",
  "watch_panel_back_action",
  "watch_panel_back_aria",
  "vote_score_separator",
  "observing_game_label",
  "chat_disabled_label",
  "chat_enabled_label",
  "chat_disable_action",
  "chat_enable_action",
  "chat_disable_pending",
  "chat_enable_pending",
  "chat_input_placeholder",
  "chat_send_action",
  "chat_sending",
  "chat_reply_action",
  "chat_reply_cancel",
  "chat_attach_image_aria",
  "chat_empty",
  "chat_image_only_hint",
  "chat_toast_disabled",
  "chat_toast_send_failed",
  "chat_toast_toggle_failed",
  "chat_emoji_aria",
  "chat_join_required_label",
  "chat_load_failed_label",
  "chat_emoji_search_placeholder",
  "chat_emoji_search_empty",
  "chat_emoji_results_prefix",
  "chat_react_action",
  "chat_react_more_aria",
  "chat_you_label",
  "chat_reply_label",
  "chat_receipt_sent_aria",
  "chat_receipt_seen_aria",
  "chat_receipt_delivered_aria",
  "chat_receipt_pending_aria",
  "chat_receipt_failed_aria",
  "chat_receipt_retry_action",
  "chat_seen_by_prefix",
  "chat_image_fallback_label",
  "chat_receipt_sent_glyph",
  "chat_receipt_read_glyph",
  "chat_receipt_delivered_glyph",
  "chat_receipt_pending_glyph",
  "chat_receipt_failed_glyph",
  "chat_seen_count_glyph",
  "chat_media_lightbox_title",
  "chat_media_lightbox_close_aria",
  "chat_date_today",
  "chat_date_yesterday",
  "match_intro_vs_label",
  "match_intro_duration_ms",
  "match_intro_aria",
];

export function isSpectateChromeReady(
  chrome: SpectateChrome | null | undefined,
): chrome is Required<SpectateChrome> {
  if (!chrome) return false;
  return SPECTATE_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
