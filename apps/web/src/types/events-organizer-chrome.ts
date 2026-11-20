export type EventsOrganizerChrome = {
  source?: string;
  events_organizer_chrome_unavailable?: string;
  brand_name?: string;
  dashboard_title?: string;
  dashboard_blurb?: string;
  list_title?: string;
  list_blurb?: string;
  create_action?: string;
  create_pending?: string;
  create_title?: string;
  create_blurb?: string;
  title_label?: string;
  title_placeholder?: string;
  format_label?: string;
  size_label?: string;
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
  toast_arena_start_failed?: string;
  toast_arena_queue_failed?: string;
  arena_finish_action?: string;
  arena_finish_pending?: string;
  toast_arena_finished?: string;
  toast_arena_finish_failed?: string;
  arena_finish_requires_started?: string;
  arena_finish_already_finished?: string;
  max_players_label?: string;
  unlimited_players_label?: string;
  entry_fee_label?: string;
  /** Amount field hint when paid entry is enabled. */
  entry_fee_placeholder?: string;
  entry_free_label?: string;
  auto_approve_label?: string;
  host_fee_label?: string;
  pay_create_action?: string;
  cancel_action?: string;
  dialog_close_label?: string;
  close_action?: string;
  reopen_action?: string;
  cannot_reopen_blurb?: string;
  toast_closed?: string;
  toast_reopened?: string;
  toast_close_failed?: string;
  toast_reopen_failed?: string;
  auto_closed_badge?: string;
  search_label?: string;
  search_placeholder?: string;
  status_filter_label?: string;
  filter_status_all?: string;
  filter_all_label?: string;
  filter_free_label?: string;
  filter_paid_label?: string;
  filter_entry_label?: string;
  public_rated_on_blurb?: string;
  public_rated_off_blurb?: string;
  empty_list?: string;
  manage_action?: string;
  row_actions_label?: string;
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  bulk_close_action?: string;
  bulk_reopen_action?: string;
  bulk_action_pending?: string;
  overview_tab?: string;
  join_tab?: string;
  players_tab?: string;
  bracket_tab?: string;
  branding_tab?: string;
  results_tab?: string;
  join_code_label?: string;
  join_link_label?: string;
  copy_code_action?: string;
  copy_link_action?: string;
  download_qr_action?: string;
  copied_blurb?: string;
  toast_copy_failed?: string;
  qr_unavailable?: string;
  toast_qr_download_failed?: string;
  approve_action?: string;
  reject_action?: string;
  kick_action?: string;
  start_action?: string;
  start_game_action?: string;
  /** Organizer DQ / no-show forfeit on a ready or live bracket match. */
  forfeit_action?: string;
  forfeit_pending?: string;
  toast_forfeit_failed?: string;
  rematch_action?: string;
  rematch_pending?: string;
  toast_rematch_failed?: string;
  official_pause_action?: string;
  official_pause_pending?: string;
  official_resume_action?: string;
  official_resume_pending?: string;
  toast_official_paused?: string;
  toast_official_resumed?: string;
  toast_official_pause_failed?: string;
  toast_official_resume_failed?: string;
  official_pause_status_label?: string;
  open_match_action?: string;
  players_pending_label?: string;
  players_approved_label?: string;
  players_rejected_label?: string;
  /** Optional manage-players badge when entry has checked_in_at (soft-filled by mig 509). */
  players_checked_in_label?: string;
  /** Optional manage-players link to public player profile (soft-filled by mig 511). */
  players_open_player_label?: string;
  bracket_title?: string;
  winners_title?: string;
  /** Share winners / result card (manage results tab). */
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
  wide_dialog_max_width?: string;
  search_field_max_width?: string;
  list_blurb_max_width?: string;
  standings_table_min_width?: string;
  page_card_pad?: string;
  page_card_gap?: string;
  dashboard_tile_pad?: string;
  dashboard_tile_radius?: string;
  analytics_chip_pad_h?: string;
  analytics_chip_pad_v?: string;
  analytics_chip_radius?: string;
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
  admin_formats_blurb?: string;
  sponsor_name_label?: string;
  sponsor_name_placeholder?: string;
  sponsor_logo_label?: string;
  logo_label?: string;
  brand_color_label?: string;
  brand_color_placeholder?: string;
  description_label?: string;
  description_placeholder?: string;
  prize_media_section_title?: string;
  prize_media_section_blurb?: string;
  thumbnail_label?: string;
  gallery_label?: string;
  gallery_add_action?: string;
  gallery_empty?: string;
  thumbnail_upload_action?: string;
  thumbnail_upload_pending?: string;
  gallery_upload_pending?: string;
  toast_thumbnail_saved?: string;
  toast_gallery_saved?: string;
  media_upload_failed?: string;
  gallery_max_slots?: string;
  gallery_slots_fmt?: string;
  thumbnail_main_badge?: string;
  thumbnail_empty_hint?: string;
  thumbnail_hint?: string;
  gallery_limit_reached?: string;
  upload_logo_action?: string;
  upload_sponsor_action?: string;
  toast_created?: string;
  toast_create_failed?: string;
  toast_started?: string;
  toast_start_failed?: string;
  toast_saved?: string;
  toast_save_failed?: string;
  /** Primary save button label (manage title/branding); not toast_saved. */
  save_action?: string;
  save_pending?: string;
  toast_cancelled?: string;
  insufficient_host_fee?: string;
  top_up_action?: string;
  top_up_href?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  empty_value?: string;
  feature_disabled?: string;
  not_organizer?: string;
  not_enough_players?: string;
  format_unavailable?: string;
  size_unavailable?: string;
  already_started?: string;
  cannot_join_status?: string;
  event_full?: string;
  meta_separator?: string;
  bracket_bye_label?: string;
  bracket_vs_label?: string;
  bracket_empty_seat?: string;
  players_count_suffix?: string;
  amount_currency_separator?: string;
  kpi_active_label?: string;
  kpi_upcoming_label?: string;
  kpi_players_week_label?: string;
  kpi_paused_boards_label?: string;
  kpi_paused_avg_label?: string;
  live_paused_section_title?: string;
  activity_section_title?: string;
  kpi_host_fee_revenue_label?: string;
  kpi_entry_fee_revenue_label?: string;
  kpi_entry_fee_gross_label?: string;
  kpi_entry_fee_commission_label?: string;
  kpi_entry_fee_net_label?: string;
  kpi_last_share_label?: string;
  commission_percent_label?: string;
  commission_blurb_template?: string;
  payments_commission_label?: string;
  payments_organizer_net_label?: string;
  analytics_title?: string;
  analytics_blurb?: string;
  analytics_players_label?: string;
  analytics_completion_label?: string;
  analytics_started_label?: string;
  analytics_host_fee_label?: string;
  analytics_entry_fees_label?: string;
  analytics_commission_label?: string;
  analytics_entry_net_label?: string;
  analytics_empty?: string;
  analytics_metrics_note?: string;
  patch_title_locked?: string;
  upload_logo_failed?: string;
  upload_sponsor_failed?: string;
  payments_tab?: string;
  live_board_tab?: string;
  host_fee_paid_label?: string;
  entry_fees_collected_label?: string;
  entry_fees_gross_label?: string;
  copy_invite_action?: string;
  invite_text_template?: string;
  visibility_label?: string;
  visibility_private_label?: string;
  visibility_public_label?: string;
  visibility_private_blurb?: string;
  visibility_public_blurb?: string;
  public_disabled?: string;
  make_public_action?: string;
  make_private_action?: string;
  visibility_change_blocked?: string;
  report_action?: string;
  report_title?: string;
  report_reason_label?: string;
  report_note_label?: string;
  report_submit_action?: string;
  report_toast_sent?: string;
  report_toast_failed?: string;
  portal_wallet_label?: string;
  portal_receipts_label?: string;
  portal_transactions_label?: string;
  portal_overview_label?: string;
  portal_create_label?: string;
  portal_public_list_label?: string;
  portal_money_section_title?: string;
  portal_payout_label?: string;
  portal_payout_blurb?: string;
  portal_wallet_href?: string;
  portal_receipts_href?: string;
  portal_transactions_href?: string;
  portal_payout_href?: string;
  portal_overview_href?: string;
  portal_create_href?: string;
  portal_public_list_href?: string;
  public_list_title?: string;
  public_list_blurb?: string;
  public_list_empty?: string;
  join_open_action?: string;
  force_auto_approve_note?: string;
  prize_pool_display_label?: string;
  prize_pool_display_blurb?: string;
  prize_pool_guarantee_label?: string;
  prize_pool_guarantee_blurb?: string;
  prize_pool_guarantee_amount_label?: string;
  prize_pool_guarantee_amount_placeholder?: string;
  prize_pool_now_label?: string;
  prize_pool_if_full_label?: string;
  prize_pool_guaranteed_label?: string;
  prize_pool_frozen_blurb?: string;
  prize_pool_entry_fees_note?: string;
  insufficient_prize_guarantee?: string;
  err_prize_guarantee_amount_invalid?: string;
  err_prize_guarantee_settle_failed?: string;
  err_host_guarantee_requires_document_kyc?: string;
  err_host_paid_requires_phone_kyc?: string;
  err_host_concurrent_open_paid_cap?: string;
  err_host_reputation_blocked?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
  host_trust_badge_unverified?: string;
  host_trust_badge_phone_verified?: string;
  host_trust_badge_document_verified?: string;
  err_guarantee_live_cannot_release?: string;
  err_reopen_guarantee_hold_failed?: string;
  prize_pool_unavailable?: string;
  payout_mode_label?: string;
  payout_mode_blurb?: string;
  payout_mode_places_percent_label?: string;
  payout_mode_score_share_label?: string;
  payout_mode_dual_purse_label?: string;
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
};

const EVENTS_ORGANIZER_CHROME_KEYS: (keyof EventsOrganizerChrome)[] = [
  "source",
  "events_organizer_chrome_unavailable",
  "brand_name",
  "dashboard_title",
  "dashboard_blurb",
  "list_title",
  "list_blurb",
  "create_action",
  "create_pending",
  "create_title",
  "create_blurb",
  "title_label",
  "title_placeholder",
  "format_label",
  "size_label",
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
  "toast_arena_start_failed",
  "toast_arena_queue_failed",
  "arena_finish_action",
  "arena_finish_pending",
  "toast_arena_finished",
  "toast_arena_finish_failed",
  "arena_finish_requires_started",
  "arena_finish_already_finished",
  "max_players_label",
  "unlimited_players_label",
  "entry_fee_label",
  "entry_fee_placeholder",
  "entry_free_label",
  "auto_approve_label",
  "host_fee_label",
  "pay_create_action",
  "cancel_action",
  "dialog_close_label",
  "close_action",
  "reopen_action",
  "cannot_reopen_blurb",
  "toast_closed",
  "toast_reopened",
  "toast_close_failed",
  "toast_reopen_failed",
  "auto_closed_badge",
  "search_label",
  "search_placeholder",
  "status_filter_label",
  "filter_status_all",
  "filter_all_label",
  "filter_free_label",
  "filter_paid_label",
  "filter_entry_label",
  "public_rated_on_blurb",
  "public_rated_off_blurb",
  "empty_list",
  "manage_action",
  "row_actions_label",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "bulk_close_action",
  "bulk_reopen_action",
  "bulk_action_pending",
  "overview_tab",
  "join_tab",
  "players_tab",
  "bracket_tab",
  "branding_tab",
  "results_tab",
  "join_code_label",
  "join_link_label",
  "copy_code_action",
  "copy_link_action",
  "download_qr_action",
  "copied_blurb",
  "toast_copy_failed",
  "qr_unavailable",
  "toast_qr_download_failed",
  "approve_action",
  "reject_action",
  "kick_action",
  "start_action",
  "start_game_action",
  "forfeit_action",
  "forfeit_pending",
  "toast_forfeit_failed",
  "rematch_action",
  "rematch_pending",
  "toast_rematch_failed",
  "official_pause_action",
  "official_pause_pending",
  "official_resume_action",
  "official_resume_pending",
  "toast_official_paused",
  "toast_official_resumed",
  "toast_official_pause_failed",
  "toast_official_resume_failed",
  "official_pause_status_label",
  "open_match_action",
  "players_pending_label",
  "players_approved_label",
  "players_rejected_label",
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
  "wide_dialog_max_width",
  "search_field_max_width",
  "list_blurb_max_width",
  "standings_table_min_width",
  "page_card_pad",
  "page_card_gap",
  "dashboard_tile_pad",
  "dashboard_tile_radius",
  "analytics_chip_pad_h",
  "analytics_chip_pad_v",
  "analytics_chip_radius",
  "phase_group_label",
  "phase_knockout_label",
  "phase_swiss_label",
  "phase_round_robin_label",
  "admin_formats_blurb",
  "sponsor_name_label",
  "sponsor_name_placeholder",
  "sponsor_logo_label",
  "logo_label",
  "brand_color_label",
  "brand_color_placeholder",
  "description_label",
  "description_placeholder",
  "prize_media_section_title",
  "prize_media_section_blurb",
  "thumbnail_label",
  "gallery_label",
  "gallery_add_action",
  "gallery_empty",
  "thumbnail_upload_action",
  "thumbnail_upload_pending",
  "gallery_upload_pending",
  "toast_thumbnail_saved",
  "toast_gallery_saved",
  "media_upload_failed",
  "gallery_max_slots",
  "gallery_slots_fmt",
  "thumbnail_main_badge",
  "thumbnail_empty_hint",
  "thumbnail_hint",
  "gallery_limit_reached",
  "upload_logo_action",
  "upload_sponsor_action",
  "toast_created",
  "toast_create_failed",
  "toast_started",
  "toast_start_failed",
  "toast_saved",
  "toast_save_failed",
  "save_action",
  "save_pending",
  "toast_cancelled",
  "insufficient_host_fee",
  "top_up_action",
  "top_up_href",
  "list_page_size",
  "empty_value",
  "feature_disabled",
  "not_organizer",
  "not_enough_players",
  "format_unavailable",
  "size_unavailable",
  "already_started",
  "cannot_join_status",
  "event_full",
  "meta_separator",
  "bracket_bye_label",
  "bracket_vs_label",
  "bracket_empty_seat",
  "players_count_suffix",
  "amount_currency_separator",
  "kpi_active_label",
  "kpi_upcoming_label",
  "kpi_players_week_label",
  "kpi_paused_boards_label",
  "kpi_paused_avg_label",
  "live_paused_section_title",
  "activity_section_title",
  "kpi_host_fee_revenue_label",
  "kpi_entry_fee_revenue_label",
  "kpi_entry_fee_gross_label",
  "kpi_entry_fee_commission_label",
  "kpi_entry_fee_net_label",
  "kpi_last_share_label",
  "commission_percent_label",
  "commission_blurb_template",
  "payments_commission_label",
  "payments_organizer_net_label",
  "analytics_title",
  "analytics_blurb",
  "analytics_players_label",
  "analytics_completion_label",
  "analytics_started_label",
  "analytics_host_fee_label",
  "analytics_entry_fees_label",
  "analytics_commission_label",
  "analytics_entry_net_label",
  "analytics_empty",
  "analytics_metrics_note",
  "patch_title_locked",
  "upload_logo_failed",
  "upload_sponsor_failed",
  "payments_tab",
  "live_board_tab",
  "host_fee_paid_label",
  "entry_fees_collected_label",
  "entry_fees_gross_label",
  "copy_invite_action",
  "invite_text_template",
  "visibility_label",
  "visibility_private_label",
  "visibility_public_label",
  "visibility_private_blurb",
  "visibility_public_blurb",
  "public_disabled",
  "make_public_action",
  "make_private_action",
  "visibility_change_blocked",
  "report_action",
  "report_title",
  "report_reason_label",
  "report_note_label",
  "report_submit_action",
  "report_toast_sent",
  "report_toast_failed",
  "portal_wallet_label",
  "portal_receipts_label",
  "portal_transactions_label",
  "portal_overview_label",
  "portal_create_label",
  "portal_public_list_label",
  "portal_money_section_title",
  "portal_payout_label",
  "portal_payout_blurb",
  "portal_wallet_href",
  "portal_receipts_href",
  "portal_transactions_href",
  "portal_payout_href",
  "portal_overview_href",
  "portal_create_href",
  "portal_public_list_href",
  "public_list_title",
  "public_list_blurb",
  "public_list_empty",
  "join_open_action",
  "force_auto_approve_note",
  "prize_pool_display_label",
  "prize_pool_display_blurb",
  "prize_pool_guarantee_label",
  "prize_pool_guarantee_blurb",
  "prize_pool_guarantee_amount_label",
  "prize_pool_guarantee_amount_placeholder",
  "prize_pool_now_label",
  "prize_pool_if_full_label",
  "prize_pool_guaranteed_label",
  "prize_pool_frozen_blurb",
  "prize_pool_entry_fees_note",
  "insufficient_prize_guarantee",
  "err_prize_guarantee_amount_invalid",
  "err_prize_guarantee_settle_failed",
  "err_host_guarantee_requires_document_kyc",
  "err_host_paid_requires_phone_kyc",
  "err_host_concurrent_open_paid_cap",
  "err_host_reputation_blocked",
  "host_rep_finished_label",
  "host_rep_cancelled_label",
  "host_rep_reports_label",
  "host_rep_meta_separator",
  "host_trust_badge_unverified",
  "host_trust_badge_phone_verified",
  "host_trust_badge_document_verified",
  "err_guarantee_live_cannot_release",
  "err_reopen_guarantee_hold_failed",
  "prize_pool_unavailable",
  "payout_mode_label",
  "payout_mode_blurb",
  "payout_mode_places_percent_label",
  "payout_mode_score_share_label",
  "payout_mode_dual_purse_label",
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
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

export function isEventsOrganizerChromeReady(
  chrome: EventsOrganizerChrome | null | undefined,
): chrome is Required<EventsOrganizerChrome> {
  if (!chrome) return false;
  return EVENTS_ORGANIZER_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
