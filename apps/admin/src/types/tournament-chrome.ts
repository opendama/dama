export type TournamentChrome = {
  source?: string;
  page_title?: string;
  /** Top tab label for the tournaments list route. */
  tab_list_label?: string;
  /** Top tab label for platform-wide official pause live boards. */
  tab_live_boards_label?: string;
  detail_players_section_title?: string;
  detail_players_section_blurb?: string;
  detail_players_col_user?: string;
  detail_players_col_status?: string;
  detail_players_col_checked_in?: string;
  detail_players_col_placement?: string;
  detail_players_empty?: string;
  detail_players_open_user?: string;
  detail_yes?: string;
  detail_no?: string;
  page_blurb?: string;
  title_label?: string;
  title_placeholder?: string;
  description_label?: string;
  description_placeholder?: string;
  make_free_label?: string;
  entry_currency_label?: string;
  entry_amount_label?: string;
  /** Paid create/edit: shown when entry fee is missing or not positive. */
  entry_fee_required?: string;
  /** Create/edit: shown when title is blank on submit. */
  title_required?: string;
  prize_amount_label?: string;
  prize_currency_label?: string;
  prize_placeholder?: string;
  create_action?: string;
  create_pending?: string;
  status_update_pending?: string;
  existing_title?: string;
  is_free_prefix?: string;
  is_free_true?: string;
  is_free_false?: string;
  prize_prefix?: string;
  toast_created?: string;
  toast_create_failed?: string;
  toast_status_updated?: string;
  toast_status_failed?: string;
  tournament_chrome_unavailable?: string;
  meta_separator?: string;
  amount_currency_separator?: string;
  free_entry_amount?: string;
  thumbnail_label?: string;
  gallery_label?: string;
  gallery_add_action?: string;
  gallery_empty?: string;
  gallery_max_slots?: string;
  gallery_slots_fmt?: string;
  thumbnail_main_badge?: string;
  thumbnail_empty_hint?: string;
  thumbnail_hint?: string;
  gallery_limit_reached?: string;
  thumbnail_upload_action?: string;
  thumbnail_upload_pending?: string;
  gallery_upload_pending?: string;
  toast_thumbnail_saved?: string;
  toast_gallery_saved?: string;
  media_upload_failed?: string;
  empty_value?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  prize_pool_display_label?: string;
  prize_pool_display_blurb?: string;
  prize_pool_max_players_label?: string;
  unlimited_players_label?: string;
  prize_pool_max_players_unlimited_blurb?: string;
  err_unlimited_arena_only?: string;
  err_max_players_required?: string;
  prize_pool_now_label?: string;
  prize_pool_if_full_label?: string;
  prize_pool_guaranteed_label?: string;
  prize_pool_frozen_blurb?: string;
  prize_pool_entry_fees_note?: string;
  prize_places_section_label?: string;
  prize_place_1_label?: string;
  prize_place_2_label?: string;
  prize_place_3_label?: string;
  prize_places_blurb?: string;
  err_prize_places_sum?: string;
  filter_all_label?: string;
  filter_free_label?: string;
  filter_paid_label?: string;
  filter_entry_label?: string;
  search_label?: string;
  search_placeholder?: string;
  actions_label?: string;
  col_title?: string;
  col_entry?: string;
  col_status?: string;
  col_prize?: string;
  col_actions?: string;
  view_detail_action?: string;
  edit_action?: string;
  delete_action?: string;
  cancel_action?: string;
  dialog_close_label?: string;
  save_action?: string;
  save_pending?: string;
  create_modal_title?: string;
  edit_modal_title?: string;
  detail_modal_title?: string;
  detail_close_label?: string;
  delete_confirm?: string;
  toast_updated?: string;
  toast_update_failed?: string;
  toast_deleted?: string;
  toast_delete_failed?: string;
  err_update_failed?: string;
  err_delete_failed?: string;
  search_debounce_ms?: string;
  status_field_label?: string;
  created_at_label?: string;
  empty_list?: string;
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  start_cup_action?: string;
  start_cup_pending?: string;
  cup_started_at_label?: string;
  cup_finished_at_label?: string;
  cup_not_started_value?: string;
  cup_not_finished_value?: string;
  err_start_failed?: string;
  not_enough_players?: string;
  err_refund_failed?: string;
  err_cup_already_started?: string;
  status_after_start_blurb?: string;
  format_label?: string;
  format_required?: string;
  force_start_match_action?: string;
  force_start_match_pending?: string;
  forfeit_action?: string;
  forfeit_pending?: string;
  rematch_action?: string;
  rematch_pending?: string;
  official_pause_action?: string;
  official_pause_pending?: string;
  official_resume_action?: string;
  official_resume_pending?: string;
  toast_official_paused?: string;
  toast_official_resumed?: string;
  toast_official_pause_failed?: string;
  toast_official_resume_failed?: string;
  official_pause_status_label?: string;
  err_forfeit_failed?: string;
  err_rematch_failed?: string;
  err_match_not_found?: string;
  err_match_not_ready?: string;
  settle_prizes_action?: string;
  settle_prizes_pending?: string;
  settle_prizes_success_fmt?: string;
  settle_prizes_none_due?: string;
  settle_prizes_failed?: string;
  settle_prizes_requires_finished?: string;
  settle_prizes_already_settled?: string;
  control_room_title?: string;
  check_in_window_label?: string;
  reports_title?: string;
  reports_blurb?: string;
  reports_empty?: string;
  report_reason_col?: string;
  report_tournament_col?: string;
  report_reporter_col?: string;
  report_status_col?: string;
  dismiss_action?: string;
  resolve_action?: string;
  toast_dismissed?: string;
  toast_resolved?: string;
  err_report_not_found?: string;
  err_reports_failed?: string;
  err_dismiss_failed?: string;
  err_resolve_failed?: string;
  arena_duration_label?: string;
  arena_duration_required?: string;
  arena_duration_length_placeholder?: string;
  arena_duration_unit_label?: string;
  arena_duration_unit_minutes?: string;
  arena_duration_unit_hours?: string;
  arena_duration_unit_days?: string;
  arena_duration_unit_weeks?: string;
  arena_duration_unit_months?: string;
  arena_duration_mode_length?: string;
  arena_duration_mode_ends_at?: string;
  arena_duration_ends_at_label?: string;
  arena_duration_ends_at_placeholder?: string;
  arena_duration_ends_at_past?: string;
  arena_duration_blurb?: string;
  err_arena_start_failed?: string;
  err_arena_queue_failed?: string;
  arena_settings_title?: string;
  arena_settings_blurb?: string;
  arena_settings_save_action?: string;
  arena_settings_save_pending?: string;
  arena_settings_toast_saved?: string;
  arena_settings_toast_failed?: string;
  arena_settings_label_points_win?: string;
  arena_settings_label_points_draw?: string;
  arena_settings_label_points_loss?: string;
  arena_settings_label_streak_second?: string;
  arena_settings_label_streak_third_plus?: string;
  arena_settings_label_default_duration?: string;
  arena_settings_label_pairing_mode?: string;
  arena_settings_label_auto_start?: string;
  arena_settings_label_pair_interval?: string;
  arena_settings_label_allow_join_while_live?: string;
  arena_finish_action?: string;
  arena_finish_pending?: string;
  toast_arena_finished?: string;
  toast_arena_finish_failed?: string;
  arena_finish_requires_started?: string;
  arena_finish_already_finished?: string;
  prize_settle_settings_title?: string;
  prize_settle_settings_blurb?: string;
  prize_settle_settings_save_action?: string;
  prize_settle_settings_save_pending?: string;
  prize_settle_settings_toast_saved?: string;
  prize_settle_settings_toast_failed?: string;
  prize_settle_label_auto_settle?: string;
  prize_settle_label_dispute_hours?: string;
  prize_settle_label_interval_minutes?: string;
  prize_settle_auto_settle_blurb?: string;
  dispute_window_ends_at_label?: string;
  dispute_window_not_open_value?: string;
  prize_settled_at_label?: string;
  prize_not_settled_value?: string;
  payout_default_format_knockout_label?: string;
  payout_default_format_round_robin_label?: string;
  payout_default_format_swiss_label?: string;
  payout_default_format_groups_knockout_label?: string;
  payout_default_format_arena_label?: string;
  projected_payout_section_label?: string;
  projected_payout_blurb?: string;
  payout_mode_label?: string;
  payout_mode_blurb?: string;
  payout_mode_places_percent_label?: string;
  payout_mode_score_share_label?: string;
  payout_mode_dual_purse_label?: string;
  dual_purse_place_percent_label?: string;
  dual_purse_place_percent_blurb?: string;
  prize_place_percents_section_label?: string;
  prize_place_percents_blurb?: string;
  prize_place_percent_1_label?: string;
  prize_place_percent_1_placeholder?: string;
  prize_place_percent_2_label?: string;
  prize_place_percent_2_placeholder?: string;
  prize_place_percent_3_label?: string;
  prize_place_percent_3_placeholder?: string;
  err_prize_place_percents_sum?: string;
  err_payout_mode_invalid?: string;
  err_payout_mode_score_share_knockout?: string;
  standings_settings_title?: string;
  standings_settings_blurb?: string;
  standings_settings_label_points_win?: string;
  standings_settings_label_points_draw?: string;
  standings_settings_save_action?: string;
  standings_settings_save_pending?: string;
  standings_settings_toast_saved?: string;
  standings_settings_toast_failed?: string;
  payout_settings_title?: string;
  payout_settings_blurb?: string;
  payout_settings_save_action?: string;
  payout_settings_save_pending?: string;
  payout_settings_toast_saved?: string;
  payout_settings_toast_failed?: string;
  points_toast_settings_title?: string;
  points_toast_settings_blurb?: string;
  points_toast_settings_label_arena_points?: string;
  points_toast_settings_label_standings_points?: string;
  points_toast_settings_label_toast_fmt?: string;
  points_toast_settings_label_notif_title?: string;
  points_toast_settings_label_notif_body?: string;
  points_toast_settings_notif_body_blurb?: string;
  points_toast_settings_save_action?: string;
  points_toast_settings_save_pending?: string;
  points_toast_settings_toast_saved?: string;
  points_toast_settings_toast_failed?: string;
};

const TOURNAMENT_CHROME_KEYS: (keyof TournamentChrome)[] = [
  "source",
  "page_title",
  "tab_list_label",
  "tab_live_boards_label",
  "page_blurb",
  "title_label",
  "title_placeholder",
  "description_label",
  "description_placeholder",
  "make_free_label",
  "entry_currency_label",
  "entry_amount_label",
  "entry_fee_required",
  "title_required",
  "prize_amount_label",
  "prize_currency_label",
  "prize_placeholder",
  "create_action",
  "create_pending",
  "status_update_pending",
  "existing_title",
  "is_free_prefix",
  "is_free_true",
  "is_free_false",
  "prize_prefix",
  "toast_created",
  "toast_create_failed",
  "toast_status_updated",
  "toast_status_failed",
  "tournament_chrome_unavailable",
  "meta_separator",
  "amount_currency_separator",
  "free_entry_amount",
  "thumbnail_label",
  "gallery_label",
  "gallery_add_action",
  "gallery_empty",
  "gallery_max_slots",
  "gallery_slots_fmt",
  "thumbnail_main_badge",
  "thumbnail_empty_hint",
  "thumbnail_hint",
  "gallery_limit_reached",
  "thumbnail_upload_action",
  "thumbnail_upload_pending",
  "gallery_upload_pending",
  "toast_thumbnail_saved",
  "toast_gallery_saved",
  "media_upload_failed",
  "empty_value",
  "list_page_size",
  "prize_pool_display_label",
  "prize_pool_display_blurb",
  "prize_pool_max_players_label",
  "unlimited_players_label",
  "prize_pool_max_players_unlimited_blurb",
  "err_unlimited_arena_only",
  "err_max_players_required",
  "prize_pool_now_label",
  "prize_pool_if_full_label",
  "prize_pool_guaranteed_label",
  "prize_pool_frozen_blurb",
  "prize_pool_entry_fees_note",
  "prize_places_section_label",
  "prize_place_1_label",
  "prize_place_2_label",
  "prize_place_3_label",
  "prize_places_blurb",
  "err_prize_places_sum",
  "filter_all_label",
  "filter_free_label",
  "filter_paid_label",
  "filter_entry_label",
  "search_label",
  "search_placeholder",
  "actions_label",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "col_title",
  "col_entry",
  "col_status",
  "col_prize",
  "col_actions",
  "view_detail_action",
  "edit_action",
  "delete_action",
  "cancel_action",
  "dialog_close_label",
  "save_action",
  "save_pending",
  "create_modal_title",
  "edit_modal_title",
  "detail_modal_title",
  "detail_close_label",
  "delete_confirm",
  "toast_updated",
  "toast_update_failed",
  "toast_deleted",
  "toast_delete_failed",
  "err_update_failed",
  "err_delete_failed",
  "search_debounce_ms",
  "status_field_label",
  "created_at_label",
  "empty_list",
  "start_cup_action",
  "start_cup_pending",
  "err_start_failed",
  "err_cup_already_started",
  "status_after_start_blurb",
  "format_label",
  "format_required",
  "force_start_match_action",
  "force_start_match_pending",
  "forfeit_action",
  "forfeit_pending",
  "rematch_action",
  "rematch_pending",
  "official_pause_action",
  "official_pause_pending",
  "official_resume_action",
  "official_resume_pending",
  "toast_official_paused",
  "toast_official_resumed",
  "toast_official_pause_failed",
  "toast_official_resume_failed",
  "official_pause_status_label",
  "settle_prizes_action",
  "settle_prizes_pending",
  "settle_prizes_success_fmt",
  "settle_prizes_none_due",
  "settle_prizes_failed",
  "settle_prizes_requires_finished",
  "settle_prizes_already_settled",
  "control_room_title",
  "check_in_window_label",
  "not_enough_players",
  "err_refund_failed",
  "err_forfeit_failed",
  "err_rematch_failed",
  "err_match_not_found",
  "err_match_not_ready",
  "reports_title",
  "reports_blurb",
  "reports_empty",
  "report_reason_col",
  "report_tournament_col",
  "report_reporter_col",
  "report_status_col",
  "dismiss_action",
  "resolve_action",
  "toast_dismissed",
  "toast_resolved",
  "err_report_not_found",
  "err_reports_failed",
  "err_dismiss_failed",
  "err_resolve_failed",
  "arena_duration_label",
  "arena_duration_required",
  "arena_duration_length_placeholder",
  "arena_duration_unit_label",
  "arena_duration_unit_minutes",
  "arena_duration_unit_hours",
  "arena_duration_unit_days",
  "arena_duration_unit_weeks",
  "arena_duration_unit_months",
  "arena_duration_mode_length",
  "arena_duration_mode_ends_at",
  "arena_duration_ends_at_label",
  "arena_duration_ends_at_placeholder",
  "arena_duration_ends_at_past",
  "arena_duration_blurb",
  "err_arena_start_failed",
  "err_arena_queue_failed",
  "arena_settings_title",
  "arena_settings_blurb",
  "arena_settings_save_action",
  "arena_settings_save_pending",
  "arena_settings_toast_saved",
  "arena_settings_toast_failed",
  "arena_settings_label_points_win",
  "arena_settings_label_points_draw",
  "arena_settings_label_points_loss",
  "arena_settings_label_streak_second",
  "arena_settings_label_streak_third_plus",
  "arena_settings_label_default_duration",
  "arena_settings_label_pairing_mode",
  "arena_settings_label_auto_start",
  "arena_settings_label_pair_interval",
  "arena_settings_label_allow_join_while_live",
  "arena_finish_action",
  "arena_finish_pending",
  "toast_arena_finished",
  "toast_arena_finish_failed",
  "arena_finish_requires_started",
  "arena_finish_already_finished",
  "prize_settle_settings_title",
  "prize_settle_settings_blurb",
  "prize_settle_settings_save_action",
  "prize_settle_settings_save_pending",
  "prize_settle_settings_toast_saved",
  "prize_settle_settings_toast_failed",
  "prize_settle_label_auto_settle",
  "prize_settle_label_dispute_hours",
  "prize_settle_label_interval_minutes",
  "prize_settle_auto_settle_blurb",
  "dispute_window_ends_at_label",
  "dispute_window_not_open_value",
  "prize_settled_at_label",
  "prize_not_settled_value",
  "payout_default_format_knockout_label",
  "payout_default_format_round_robin_label",
  "payout_default_format_swiss_label",
  "payout_default_format_groups_knockout_label",
  "payout_default_format_arena_label",
  "projected_payout_section_label",
  "projected_payout_blurb",
  "payout_mode_label",
  "payout_mode_blurb",
  "payout_mode_places_percent_label",
  "payout_mode_score_share_label",
  "payout_mode_dual_purse_label",
  "dual_purse_place_percent_label",
  "dual_purse_place_percent_blurb",
  "prize_place_percents_section_label",
  "prize_place_percents_blurb",
  "prize_place_percent_1_label",
  "prize_place_percent_1_placeholder",
  "prize_place_percent_2_label",
  "prize_place_percent_2_placeholder",
  "prize_place_percent_3_label",
  "prize_place_percent_3_placeholder",
  "err_prize_place_percents_sum",
  "err_payout_mode_invalid",
  "err_payout_mode_score_share_knockout",
  "standings_settings_title",
  "standings_settings_blurb",
  "standings_settings_label_points_win",
  "standings_settings_label_points_draw",
  "standings_settings_save_action",
  "standings_settings_save_pending",
  "standings_settings_toast_saved",
  "standings_settings_toast_failed",
  "payout_settings_title",
  "payout_settings_blurb",
  "payout_settings_save_action",
  "payout_settings_save_pending",
  "payout_settings_toast_saved",
  "payout_settings_toast_failed",
  "points_toast_settings_title",
  "points_toast_settings_blurb",
  "points_toast_settings_label_arena_points",
  "points_toast_settings_label_standings_points",
  "points_toast_settings_label_toast_fmt",
  "points_toast_settings_label_notif_title",
  "points_toast_settings_label_notif_body",
  "points_toast_settings_notif_body_blurb",
  "points_toast_settings_save_action",
  "points_toast_settings_save_pending",
  "points_toast_settings_toast_saved",
  "points_toast_settings_toast_failed",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every tournament chrome string must be present from the database. */
export function isTournamentChromeReady(
  chrome: TournamentChrome | null | undefined,
): chrome is Required<TournamentChrome> {
  if (!chrome) return false;
  return TOURNAMENT_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
