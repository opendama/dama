export type PlayRailChrome = {
  source?: string;
  play_rail_chrome_unavailable?: string;
  tab_new_game?: string;
  tab_games?: string;
  tab_players?: string;
  sub_play_ai?: string;
  sub_challenge?: string;
  sub_watch?: string;
  sub_history?: string;
  sub_friends?: string;
  sub_all_players?: string;
  sub_friend_requests?: string;
  sub_dms?: string;
  dms_requests_count_aria?: string;
  /** Cap before overflow fmt (Telegram 99+). */
  dm_unread_badge_max?: string;
  /** Must include `{max}` when count exceeds dm_unread_badge_max. */
  dm_unread_badge_overflow_fmt?: string;
  /** DMs tab aria; must include `{count}`. */
  dms_unread_count_aria?: string;
  message_action?: string;
  dm_modal_title?: string;
  dm_send_action?: string;
  dm_sending?: string;
  dm_input_placeholder?: string;
  dm_empty_requests?: string;
  dm_request_pending_label?: string;
  dm_request_outgoing_label?: string;
  dm_request_denied_label?: string;
  dm_request_cancelled_label?: string;
  dm_accept_action?: string;
  dm_accepting?: string;
  dm_deny_action?: string;
  dm_denying?: string;
  dm_cancel_action?: string;
  dm_cancelling?: string;
  dm_preview_max_chars?: string;
  dm_preview_truncate_suffix?: string;
  dm_image_preview_label?: string;
  chat_reply_preview_max_chars?: string;
  chat_loading?: string;
  dm_chat_loading?: string;
  chat_poll_interval_ms?: string;
  dm_poll_interval_ms?: string;
  dm_requests_poll_interval_ms?: string;
  more_options_aria?: string;
  chat_emoji_set?: string;
  dm_toast_sent?: string;
  dm_toast_accepted?: string;
  dm_toast_denied?: string;
  dm_toast_cancelled?: string;
  dm_toast_failed?: string;
  dm_chat_empty?: string;
  dm_reply_action?: string;
  dm_reply_cancel?: string;
  dm_attach_image_aria?: string;
  dm_emoji_aria?: string;
  dm_words_label?: string;
  remove_image_aria?: string;
  watch_tab_moves?: string;
  watch_tab_chat?: string;
  watch_tab_info?: string;
  watch_panel_back_action?: string;
  watch_panel_back_aria?: string;
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
  dm_open_failed?: string;
  dm_load_failed_label?: string;
  match_intro_vs_label?: string;
  match_intro_duration_ms?: string;
  match_intro_aria?: string;
  match_intro_starting_label?: string;
  match_result_duration_ms?: string;
  match_result_win_aria?: string;
  match_result_loss_aria?: string;
  match_result_draw_aria?: string;
  match_result_win_on_time_aria?: string;
  match_result_loss_on_time_aria?: string;
  match_result_draw_on_time_aria?: string;
  label_opponent?: string;
  label_time?: string;
  label_i_play_as?: string;
  label_rated?: string;
  label_unrated?: string;
  label_colors?: string;
  label_board?: string;
  label_pieces?: string;
  label_rating?: string;
  search_username_placeholder?: string;
  search_opponent_placeholder?: string;
  send_challenge_action?: string;
  sending_challenge?: string;
  challenge_link_action?: string;
  copied_action?: string;
  copied_share_blurb?: string;
  sign_in_to_challenge?: string;
  find_matchmaking_action?: string;
  watch_game_action?: string;
  challenge_action?: string;
  add_friend_action?: string;
  remove_friend_action?: string;
  send_friend_request_action?: string;
  sending_friend_request?: string;
  accept_friend_request_action?: string;
  accepting_friend_request?: string;
  deny_friend_request_action?: string;
  denying_friend_request?: string;
  cancel_friend_request_action?: string;
  cancelling_friend_request?: string;
  friend_request_pending_label?: string;
  friend_request_outgoing_label?: string;
  friend_request_denied_label?: string;
  empty_friend_requests?: string;
  toast_friend_request_sent?: string;
  toast_friend_request_accepted?: string;
  toast_friend_request_denied?: string;
  toast_friend_request_cancelled?: string;
  toast_friend_request_failed?: string;
  friend_request_already_friends?: string;
  /** Mini list CTA → dedicated player page. */
  view_profile_action?: string;
  /** Bell-style badge aria; must include `{count}`. */
  friend_requests_count_aria?: string;
  /** Colored flag image URL; must include `{code}` (ISO-2 lowercase). */
  country_flag_image_url_template?: string;
  removing_friend?: string;
  online_label?: string;
  playing_label?: string;
  offline_label?: string;
  empty_live_games?: string;
  empty_history?: string;
  empty_friends?: string;
  empty_players?: string;
  loading_live?: string;
  loading_history?: string;
  loading_players?: string;
  sign_in_history?: string;
  sign_in_friends?: string;
  outcome_win?: string;
  outcome_loss?: string;
  outcome_draw?: string;
  moves_suffix?: string;
  meta_separator?: string;
  stats_separator?: string;
  wins_abbr?: string;
  losses_abbr?: string;
  mode_ai?: string;
  mode_pvp?: string;
  rating_paren_open?: string;
  rating_paren_close?: string;
  toast_enter_username?: string;
  toast_sign_in_challenge?: string;
  toast_challenge_sent_prefix?: string;
  toast_challenge_failed?: string;
  /** DB: cannot challenge yourself (username or id). */
  toast_invite_yourself?: string;
  toast_copy_failed?: string;
  toast_send_link_first?: string;
  toast_friend_added?: string;
  toast_friend_removed?: string;
  toast_friend_failed?: string;
  toast_time_control_unavailable?: string;
  toast_challenge_accept_failed?: string;
  toast_game_unavailable?: string;
  aria_color_white?: string;
  aria_color_black?: string;
  aria_color_random?: string;
  color_pref_note?: string;
  board_view_2d?: string;
  board_view_3d?: string;
  share_watch_action?: string;
  flip_board_aria?: string;
  share_game_aria?: string;
  create_game_title?: string;
  resume_game_action?: string;
  new_game_modes_aria?: string;
  /** Absolute web origin for share/challenge links (mobile + copy). */
  web_app_origin?: string;
  label_players?: string;
  label_viewers?: string;
  label_game_id?: string;
  vs_separator?: string;
  viewers_overflow_prefix?: string;
  join_game_action?: string;
  download_qr_action?: string;
  download_qr_pending?: string;
  qr_preview_aria?: string;
  qr_lightbox_close_aria?: string;
  qr_unavailable?: string;
  toast_qr_download_failed?: string;
  live_game_popover_title?: string;
  games_played_abbr?: string;
  draws_abbr?: string;
  id_truncate_chars?: string;
  id_truncate_suffix?: string;
  viewers_empty_count?: string;
  /** Trim-parity search debounce delay (decimal ms string). */
  search_debounce_ms?: string;
  /** Max live-game player username length before suffix trim. */
  live_player_name_max_chars?: string;
  name_truncate_suffix?: string;
  live_viewers_title?: string;
  back_to_live_games?: string;
  empty_live_viewers?: string;
  loading_live_viewers?: string;
  /** Infinite-scroll page size (decimal string, NotificationBell parity). */
  list_page_size?: string;
  loading_more?: string;
};

const KEYS: (keyof PlayRailChrome)[] = [
  "source",
  "play_rail_chrome_unavailable",
  "tab_new_game",
  "tab_games",
  "tab_players",
  "sub_play_ai",
  "sub_challenge",
  "sub_watch",
  "sub_history",
  "sub_friends",
  "sub_all_players",
  "sub_friend_requests",
  "sub_dms",
  "dms_requests_count_aria",
  "dm_unread_badge_max",
  "dm_unread_badge_overflow_fmt",
  "dms_unread_count_aria",
  "message_action",
  "dm_modal_title",
  "dm_send_action",
  "dm_sending",
  "dm_input_placeholder",
  "dm_empty_requests",
  "dm_request_pending_label",
  "dm_request_outgoing_label",
  "dm_request_denied_label",
  "dm_request_cancelled_label",
  "dm_accept_action",
  "dm_accepting",
  "dm_deny_action",
  "dm_denying",
  "dm_cancel_action",
  "dm_cancelling",
  "dm_preview_max_chars",
  "dm_preview_truncate_suffix",
  "dm_image_preview_label",
  "chat_reply_preview_max_chars",
  "chat_loading",
  "dm_chat_loading",
  "chat_poll_interval_ms",
  "dm_poll_interval_ms",
  "dm_requests_poll_interval_ms",
  "more_options_aria",
  "chat_emoji_set",
  "dm_toast_sent",
  "dm_toast_accepted",
  "dm_toast_denied",
  "dm_toast_cancelled",
  "dm_toast_failed",
  "dm_chat_empty",
  "dm_reply_action",
  "dm_reply_cancel",
  "dm_attach_image_aria",
  "dm_emoji_aria",
  "dm_words_label",
  "remove_image_aria",
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
  "dm_open_failed",
  "dm_load_failed_label",
  "match_intro_vs_label",
  "match_intro_duration_ms",
  "match_intro_aria",
  "match_result_win_on_time_aria",
  "match_result_loss_on_time_aria",
  "match_result_draw_on_time_aria",
  "label_opponent",
  "label_time",
  "label_i_play_as",
  "label_rated",
  "label_unrated",
  "label_colors",
  "label_board",
  "label_pieces",
  "label_rating",
  "search_username_placeholder",
  "search_opponent_placeholder",
  "send_challenge_action",
  "sending_challenge",
  "challenge_link_action",
  "copied_action",
  "copied_share_blurb",
  "sign_in_to_challenge",
  "find_matchmaking_action",
  "watch_game_action",
  "challenge_action",
  "add_friend_action",
  "remove_friend_action",
  "send_friend_request_action",
  "sending_friend_request",
  "accept_friend_request_action",
  "accepting_friend_request",
  "deny_friend_request_action",
  "denying_friend_request",
  "cancel_friend_request_action",
  "cancelling_friend_request",
  "friend_request_pending_label",
  "friend_request_outgoing_label",
  "friend_request_denied_label",
  "empty_friend_requests",
  "toast_friend_request_sent",
  "toast_friend_request_accepted",
  "toast_friend_request_denied",
  "toast_friend_request_cancelled",
  "toast_friend_request_failed",
  "friend_request_already_friends",
  "view_profile_action",
  "friend_requests_count_aria",
  "country_flag_image_url_template",
  "removing_friend",
  "online_label",
  "playing_label",
  "offline_label",
  "empty_live_games",
  "empty_history",
  "empty_friends",
  "empty_players",
  "loading_live",
  "loading_history",
  "loading_players",
  "sign_in_history",
  "sign_in_friends",
  "outcome_win",
  "outcome_loss",
  "outcome_draw",
  "moves_suffix",
  "meta_separator",
  "stats_separator",
  "wins_abbr",
  "losses_abbr",
  "mode_ai",
  "mode_pvp",
  "rating_paren_open",
  "rating_paren_close",
  "toast_enter_username",
  "toast_sign_in_challenge",
  "toast_challenge_sent_prefix",
  "toast_challenge_failed",
  "toast_invite_yourself",
  "toast_copy_failed",
  "toast_send_link_first",
  "toast_friend_added",
  "toast_friend_removed",
  "toast_friend_failed",
  "toast_time_control_unavailable",
  "toast_challenge_accept_failed",
  "toast_game_unavailable",
  "aria_color_white",
  "aria_color_black",
  "aria_color_random",
  "color_pref_note",
  "board_view_2d",
  "board_view_3d",
  "share_watch_action",
  "flip_board_aria",
  "share_game_aria",
  "create_game_title",
  "resume_game_action",
  "new_game_modes_aria",
  "label_players",
  "label_viewers",
  "label_game_id",
  "vs_separator",
  "viewers_overflow_prefix",
  "join_game_action",
  "download_qr_action",
  "download_qr_pending",
  "qr_preview_aria",
  "qr_lightbox_close_aria",
  "qr_unavailable",
  "toast_qr_download_failed",
  "live_game_popover_title",
  "games_played_abbr",
  "draws_abbr",
  "id_truncate_chars",
  "id_truncate_suffix",
  "viewers_empty_count",
  "search_debounce_ms",
  "live_player_name_max_chars",
  "name_truncate_suffix",
  "live_viewers_title",
  "back_to_live_games",
  "empty_live_viewers",
  "loading_live_viewers",
  "list_page_size",
  "loading_more",
  // web_app_origin optional - required only for share/challenge URL builders
];

/** Ready for Play rail UI. `web_app_origin` may be empty (share paths fail closed). */
export type PlayRailChromeReady = Required<Omit<PlayRailChrome, "web_app_origin">> & {
  web_app_origin?: string;
};

export function isPlayRailChromeReady(
  chrome: PlayRailChrome | null | undefined,
): chrome is PlayRailChromeReady {
  if (!chrome) return false;
  return KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}
