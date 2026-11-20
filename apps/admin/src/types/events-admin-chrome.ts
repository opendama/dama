export type EventsAdminChrome = {
  source?: string;
  events_admin_chrome_unavailable?: string;
  page_title?: string;
  page_blurb?: string;
  formats_title?: string;
  formats_engine_blurb?: string;
  swiss_rounds_label?: string;
  groups_size_label?: string;
  groups_advance_label?: string;
  sizes_title?: string;
  enabled_label?: string;
  format_id_label?: string;
  catalog_item_label?: string;
  catalog_item_label_blurb?: string;
  max_players_label?: string;
  allowed_formats_label?: string;
  join_code_length_label?: string;
  auto_approve_default_label?: string;
  force_auto_approve_note?: string;
  min_players_title?: string;
  min_players_label?: string;
  save_action?: string;
  save_pending?: string;
  toast_saved?: string;
  toast_save_failed?: string;
  lacks_permissions?: string;
  load_failed?: string;
  permission_key?: string;
  public_events_flag_label?: string;
  public_events_flag_blurb?: string;
  /** Feature flag key from DB (e.g. public_events_enabled). */
  public_events_flag_key?: string;
  public_rated_flag_label?: string;
  public_rated_flag_blurb?: string;
  /** Feature flag key from DB (e.g. public_event_matches_rated). */
  public_rated_flag_key?: string;
  prize_pool_display_flag_label?: string;
  prize_pool_display_flag_blurb?: string;
  /** Feature flag key from DB (e.g. prize_pool_display_enabled). */
  prize_pool_display_flag_key?: string;
  prize_pool_guarantee_flag_label?: string;
  prize_pool_guarantee_flag_blurb?: string;
  /** Feature flag key from DB (e.g. prize_pool_guarantee_enabled). */
  prize_pool_guarantee_flag_key?: string;
  kyc_auto_approve_flag_label?: string;
  kyc_auto_approve_flag_blurb?: string;
  /** Feature flag key from DB (e.g. kyc_auto_approve). */
  kyc_auto_approve_flag_key?: string;
  host_rep_finished_label?: string;
  host_rep_cancelled_label?: string;
  host_rep_reports_label?: string;
  host_rep_meta_separator?: string;
  entry_fee_commission_label?: string;
  entry_fee_commission_blurb?: string;
  public_host_fee_multiplier_label?: string;
  public_host_fee_multiplier_blurb?: string;
  reports_title?: string;
  reports_blurb?: string;
  reports_empty?: string;
  /** Catalog section: edit report reason display labels. */
  report_reasons_title?: string;
  report_reasons_blurb?: string;
  report_reason_code_label?: string;
  report_reason_col?: string;
  report_event_col?: string;
  report_reporter_col?: string;
  report_status_col?: string;
  dismiss_action?: string;
  deactivate_action?: string;
  toast_dismissed?: string;
  toast_deactivated?: string;
  reports_permission_key?: string;
  hosted_events_title?: string;
  hosted_events_blurb?: string;
  hosted_events_empty?: string;
  hosted_col_title?: string;
  hosted_col_status?: string;
  hosted_col_organizer?: string;
  hosted_col_code?: string;
  hosted_col_players?: string;
  hosted_col_visibility?: string;
  hosted_col_created?: string;
  hosted_col_entry?: string;
  hosted_col_actions?: string;
  view_detail_action?: string;
  detail_modal_title?: string;
  detail_close_label?: string;
  detail_format_label?: string;
  detail_size_label?: string;
  detail_entry_fee_label?: string;
  detail_host_fee_label?: string;
  detail_commission_label?: string;
  detail_auto_approve_label?: string;
  detail_pending_players_label?: string;
  detail_updated_label?: string;
  detail_started_label?: string;
  detail_finished_label?: string;
  detail_cancelled_label?: string;
  detail_share_label?: string;
  detail_prize_now_label?: string;
  detail_prize_if_full_label?: string;
  detail_prize_guarantee_label?: string;
  detail_prize_frozen_label?: string;
  detail_sponsor_label?: string;
  detail_logo_label?: string;
  detail_sponsor_logo_label?: string;
  detail_description_label?: string;
  detail_prize_image_label?: string;
  detail_gallery_label?: string;
  gallery_empty?: string;
  thumbnail_label?: string;
  detail_brand_color_label?: string;
  detail_winner_label?: string;
  /** Optional mig 509: full roster section on hosted detail. */
  detail_players_section_title?: string;
  detail_players_section_blurb?: string;
  detail_players_col_user?: string;
  detail_players_col_status?: string;
  detail_players_col_checked_in?: string;
  detail_players_col_placement?: string;
  detail_players_col_rating?: string;
  detail_players_empty?: string;
  detail_players_open_user?: string;
  detail_yes?: string;
  detail_no?: string;
  amount_currency_separator?: string;
  /** Milliseconds for list search debounce (DB string). */
  search_debounce_ms?: string;
  /** Positive decimal string from DB; never invent client page size. */
  list_page_size?: string;
  /** Empty cell placeholder when username/title missing (no UUID invent). */
  empty_value?: string;
  filter_all_label?: string;
  filter_free_label?: string;
  filter_paid_label?: string;
  filter_entry_label?: string;
  search_label?: string;
  search_placeholder?: string;
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  host_fee_geo_blurb?: string;
  host_fee_ethiopia_amount_label?: string;
  host_fee_ethiopia_currency_label?: string;
  host_fee_global_amount_label?: string;
  host_fee_global_currency_label?: string;
  sizes_col_ethiopia_fee?: string;
  sizes_col_global_fee?: string;
  sizes_col_max_players?: string;
  unlimited_players_label?: string;
  sizes_unlimited_toggle_label?: string;
  sizes_unlimited_blurb?: string;
  sizes_max_players_placeholder?: string;
  err_unlimited_arena_only?: string;
  /** Unlimited toggle on: max must be empty or above classic seat ceiling. */
  err_unlimited_max_high_or_empty?: string;
  sizes_col_formats?: string;
  sizes_col_status?: string;
  sizes_col_id?: string;
  sizes_col_label?: string;
  sizes_add_action?: string;
  sizes_edit_action?: string;
  sizes_delete_action?: string;
  sizes_delete_confirm?: string;
  sizes_detail_title?: string;
  sizes_empty?: string;
  sizes_active_label?: string;
  sizes_inactive_label?: string;
  sizes_actions_label?: string;
  sizes_dialog_close_label?: string;
  sizes_cancel_action?: string;
  sizes_save_action?: string;
  sizes_save_pending?: string;
  sizes_delete_pending?: string;
  sizes_status_pending?: string;
  sizes_toast_created?: string;
  sizes_toast_updated?: string;
  sizes_toast_deleted?: string;
  sizes_toast_failed?: string;
  sizes_bulk_activate_action?: string;
  sizes_bulk_deactivate_action?: string;
  sizes_bulk_status_pending?: string;
  sizes_search_label?: string;
  sizes_search_placeholder?: string;
  sizes_sort_order_label?: string;
  err_size_id_required?: string;
  err_size_id_exists?: string;
  err_size_not_found?: string;
  err_host_fee_dual_required?: string;
};

const EVENTS_ADMIN_CHROME_KEYS: (keyof EventsAdminChrome)[] = [
  "source",
  "events_admin_chrome_unavailable",
  "page_title",
  "page_blurb",
  "formats_title",
  "formats_engine_blurb",
  "swiss_rounds_label",
  "groups_size_label",
  "groups_advance_label",
  "sizes_title",
  "enabled_label",
  "format_id_label",
  "catalog_item_label",
  "catalog_item_label_blurb",
  "max_players_label",
  "allowed_formats_label",
  "join_code_length_label",
  "auto_approve_default_label",
  "force_auto_approve_note",
  "min_players_title",
  "min_players_label",
  "save_action",
  "save_pending",
  "toast_saved",
  "toast_save_failed",
  "lacks_permissions",
  "load_failed",
  "permission_key",
  "public_events_flag_label",
  "public_events_flag_blurb",
  "public_events_flag_key",
  "public_rated_flag_label",
  "public_rated_flag_blurb",
  "public_rated_flag_key",
  "prize_pool_display_flag_label",
  "prize_pool_display_flag_blurb",
  "prize_pool_display_flag_key",
  "prize_pool_guarantee_flag_label",
  "prize_pool_guarantee_flag_blurb",
  "prize_pool_guarantee_flag_key",
  "kyc_auto_approve_flag_label",
  "kyc_auto_approve_flag_blurb",
  "kyc_auto_approve_flag_key",
  "host_rep_finished_label",
  "host_rep_cancelled_label",
  "host_rep_reports_label",
  "host_rep_meta_separator",
  "entry_fee_commission_label",
  "entry_fee_commission_blurb",
  "public_host_fee_multiplier_label",
  "public_host_fee_multiplier_blurb",
  "reports_title",
  "reports_blurb",
  "reports_empty",
  "report_reasons_title",
  "report_reasons_blurb",
  "report_reason_code_label",
  "report_reason_col",
  "report_event_col",
  "report_reporter_col",
  "report_status_col",
  "dismiss_action",
  "deactivate_action",
  "toast_dismissed",
  "toast_deactivated",
  "reports_permission_key",
  "hosted_events_title",
  "hosted_events_blurb",
  "hosted_events_empty",
  "hosted_col_title",
  "hosted_col_status",
  "hosted_col_organizer",
  "hosted_col_code",
  "hosted_col_players",
  "hosted_col_visibility",
  "hosted_col_created",
  "hosted_col_entry",
  "hosted_col_actions",
  "view_detail_action",
  "detail_modal_title",
  "detail_close_label",
  "detail_format_label",
  "detail_size_label",
  "detail_entry_fee_label",
  "detail_host_fee_label",
  "detail_commission_label",
  "detail_auto_approve_label",
  "detail_pending_players_label",
  "detail_updated_label",
  "detail_started_label",
  "detail_finished_label",
  "detail_cancelled_label",
  "detail_share_label",
  "detail_prize_now_label",
  "detail_prize_if_full_label",
  "detail_prize_guarantee_label",
  "detail_prize_frozen_label",
  "detail_sponsor_label",
  "detail_logo_label",
  "detail_sponsor_logo_label",
  "detail_description_label",
  "detail_prize_image_label",
  "detail_gallery_label",
  "gallery_empty",
  "thumbnail_label",
  "detail_brand_color_label",
  "detail_winner_label",
  "detail_yes",
  "detail_no",
  "amount_currency_separator",
  "search_debounce_ms",
  "list_page_size",
  "empty_value",
  "filter_all_label",
  "filter_free_label",
  "filter_paid_label",
  "filter_entry_label",
  "search_label",
  "search_placeholder",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "host_fee_geo_blurb",
  "host_fee_ethiopia_amount_label",
  "host_fee_ethiopia_currency_label",
  "host_fee_global_amount_label",
  "host_fee_global_currency_label",
  "sizes_col_ethiopia_fee",
  "sizes_col_global_fee",
  "sizes_col_max_players",
  "unlimited_players_label",
  "sizes_unlimited_toggle_label",
  "sizes_unlimited_blurb",
  "sizes_max_players_placeholder",
  "err_unlimited_arena_only",
  "err_unlimited_max_high_or_empty",
  "sizes_col_formats",
  "sizes_col_status",
  "sizes_col_id",
  "sizes_col_label",
  "sizes_add_action",
  "sizes_edit_action",
  "sizes_delete_action",
  "sizes_delete_confirm",
  "sizes_detail_title",
  "sizes_empty",
  "sizes_active_label",
  "sizes_inactive_label",
  "sizes_actions_label",
  "sizes_dialog_close_label",
  "sizes_cancel_action",
  "sizes_save_action",
  "sizes_save_pending",
  "sizes_delete_pending",
  "sizes_status_pending",
  "sizes_toast_created",
  "sizes_toast_updated",
  "sizes_toast_deleted",
  "sizes_toast_failed",
  "sizes_bulk_activate_action",
  "sizes_bulk_deactivate_action",
  "sizes_bulk_status_pending",
  "sizes_search_label",
  "sizes_search_placeholder",
  "sizes_sort_order_label",
  "err_size_id_required",
  "err_size_id_exists",
  "err_size_not_found",
  "err_host_fee_dual_required",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  // Match Go chromeValuePresent: separators/joiners/spaces may be whitespace-only.
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every events admin chrome string must be present from the database. */
export function isEventsAdminChromeReady(
  chrome: EventsAdminChrome | null | undefined,
): chrome is Required<EventsAdminChrome> {
  if (!chrome) return false;
  return EVENTS_ADMIN_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
