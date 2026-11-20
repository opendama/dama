export type OfficialPauseReason = {
  key?: string;
  label?: string;
};

export type OfficialPauseEvent = {
  id: string;
  game_id: string;
  action: string;
  actor_user_id: string;
  actor_role: string;
  actor_display_name?: string;
  reason_key?: string;
  reason_label?: string;
  note?: string;
  event_id?: string | null;
  tournament_id?: string | null;
  created_at?: string;
};

export type OfficialPauseChrome = {
  source?: string;
  official_pause_chrome_unavailable?: string;
  pause_action?: string;
  pause_pending?: string;
  resume_action?: string;
  resume_pending?: string;
  reason_label?: string;
  reason_placeholder?: string;
  note_label?: string;
  note_placeholder?: string;
  confirm_pause_title?: string;
  confirm_pause_description?: string;
  confirm_resume_title?: string;
  confirm_resume_description?: string;
  confirm_cancel?: string;
  confirm_pause?: string;
  confirm_resume?: string;
  toast_paused?: string;
  toast_resumed?: string;
  toast_pause_failed?: string;
  toast_resume_failed?: string;
  toast_meta_saved?: string;
  toast_meta_failed?: string;
  banner_paused_fmt?: string;
  banner_paused_note_fmt?: string;
  banner_since_fmt?: string;
  banner_resumed_fmt?: string;
  activity_title?: string;
  activity_empty?: string;
  activity_pause_fmt?: string;
  activity_resume_fmt?: string;
  activity_meta_fmt?: string;
  meta_action?: string;
  meta_pending?: string;
  status_live?: string;
  status_player_pause?: string;
  status_official_pause?: string;
  status_finished?: string;
  col_match?: string;
  col_players?: string;
  col_status?: string;
  col_clock?: string;
  col_paused_by?: string;
  col_reason?: string;
  col_paused_at?: string;
  col_duration?: string;
  col_actions?: string;
  filter_official_paused?: string;
  filter_all?: string;
  role_admin_label?: string;
  role_organizer_label?: string;
  role_player_label?: string;
  clock_frozen_label?: string;
  err_forbidden?: string;
  err_reason_required?: string;
  err_reason_invalid?: string;
  err_not_live?: string;
  err_already_official?: string;
  err_not_official?: string;
  err_player_resume_blocked?: string;
  err_game_finished?: string;
  err_note_too_long?: string;
  err_rate_limited?: string;
  err_list_failed?: string;
  err_meta_not_paused?: string;
  err_audit_failed?: string;
  err_update_failed?: string;
  /** Soft-fill (mig 504); not required for chrome-ready gate. */
  err_otp?: string;
  /** Soft-fill (mig 505); not required for chrome-ready gate. */
  err_invalid_body?: string;
  bulk_pause_action?: string;
  bulk_pause_pending?: string;
  bulk_confirm_title?: string;
  bulk_confirm_description?: string;
  bulk_confirm?: string;
  toast_bulk_paused?: string;
  toast_bulk_partial?: string;
  toast_bulk_failed?: string;
  live_boards_title?: string;
  live_boards_blurb?: string;
  /** Mig 521: Live boards empty copy (required for chrome-ready). */
  live_boards_empty?: string;
  kpi_live_official_paused?: string;
  /** Soft-fill (mig 515); ASCII join between KPI label and count. */
  kpi_count_separator?: string;
  live_search_placeholder?: string;
  err_bulk_round_invalid?: string;
  err_bulk_empty?: string;
  copy_game_id_action?: string;
  toast_copied_game_id?: string;
  col_last_action?: string;
  /** Mig 518: OpsDataTable row-actions menu trigger (required for chrome-ready). */
  actions_menu_label?: string;
  /** Mig 518: selection + selection bulk (required for chrome-ready). */
  select_all_label?: string;
  select_row_label?: string;
  selected_count_fmt?: string;
  clear_selection_action?: string;
  bulk_selected_pause_action?: string;
  bulk_selected_pause_pending?: string;
  bulk_selected_confirm_title?: string;
  bulk_selected_confirm_description?: string;
  bulk_selected_confirm?: string;
  bulk_selected_resume_action?: string;
  bulk_selected_resume_pending?: string;
  bulk_selected_resume_confirm_title?: string;
  bulk_selected_resume_confirm_description?: string;
  bulk_selected_resume_confirm?: string;
  toast_bulk_resumed?: string;
  toast_bulk_resume_partial?: string;
  toast_bulk_resume_failed?: string;
  reasons?: OfficialPauseReason[];
};

const OFFICIAL_PAUSE_CHROME_KEYS: (keyof OfficialPauseChrome)[] = [
  "source",
  "official_pause_chrome_unavailable",
  "pause_action",
  "pause_pending",
  "resume_action",
  "resume_pending",
  "reason_label",
  "reason_placeholder",
  "note_label",
  "note_placeholder",
  "confirm_pause_title",
  "confirm_pause_description",
  "confirm_resume_title",
  "confirm_resume_description",
  "confirm_cancel",
  "confirm_pause",
  "confirm_resume",
  "toast_paused",
  "toast_resumed",
  "toast_pause_failed",
  "toast_resume_failed",
  "toast_meta_saved",
  "toast_meta_failed",
  "banner_paused_fmt",
  "banner_paused_note_fmt",
  "banner_since_fmt",
  "banner_resumed_fmt",
  "activity_title",
  "activity_empty",
  "activity_pause_fmt",
  "activity_resume_fmt",
  "activity_meta_fmt",
  "meta_action",
  "meta_pending",
  "status_live",
  "status_player_pause",
  "status_official_pause",
  "status_finished",
  "col_match",
  "col_players",
  "col_status",
  "col_clock",
  "col_paused_by",
  "col_reason",
  "col_paused_at",
  "col_duration",
  "col_actions",
  "filter_official_paused",
  "filter_all",
  "role_admin_label",
  "role_organizer_label",
  "role_player_label",
  "clock_frozen_label",
  "err_forbidden",
  "err_reason_required",
  "err_reason_invalid",
  "err_not_live",
  "err_already_official",
  "err_not_official",
  "err_player_resume_blocked",
  "err_game_finished",
  "err_note_too_long",
  "err_rate_limited",
  "err_list_failed",
  "err_meta_not_paused",
  "err_audit_failed",
  "err_update_failed",
  "bulk_pause_action",
  "bulk_pause_pending",
  "bulk_confirm_title",
  "bulk_confirm_description",
  "bulk_confirm",
  "toast_bulk_paused",
  "toast_bulk_partial",
  "toast_bulk_failed",
  "live_boards_title",
  "live_boards_blurb",
  "live_boards_empty",
  "kpi_live_official_paused",
  "kpi_count_separator",
  "live_search_placeholder",
  "err_bulk_round_invalid",
  "err_bulk_empty",
  "copy_game_id_action",
  "toast_copied_game_id",
  "col_last_action",
  "actions_menu_label",
  "select_all_label",
  "select_row_label",
  "selected_count_fmt",
  "clear_selection_action",
  "bulk_selected_pause_action",
  "bulk_selected_pause_pending",
  "bulk_selected_confirm_title",
  "bulk_selected_confirm_description",
  "bulk_selected_confirm",
  "bulk_selected_resume_action",
  "bulk_selected_resume_pending",
  "bulk_selected_resume_confirm_title",
  "bulk_selected_resume_confirm_description",
  "bulk_selected_resume_confirm",
  "toast_bulk_resumed",
  "toast_bulk_resume_partial",
  "toast_bulk_resume_failed",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

function reasonsReady(reasons: OfficialPauseReason[] | undefined): boolean {
  if (!Array.isArray(reasons) || reasons.length === 0) return false;
  return reasons.every(
    (r) =>
      typeof r?.key === "string" &&
      r.key.trim().length > 0 &&
      typeof r?.label === "string" &&
      r.label.trim().length > 0,
  );
}

/** Fail closed: every official-pause chrome string + reason catalog must be present. */
export function isOfficialPauseChromeReady(
  chrome: OfficialPauseChrome | null | undefined,
): chrome is Required<Omit<OfficialPauseChrome, "reasons">> & {
  reasons: OfficialPauseReason[];
} {
  if (!chrome) return false;
  if (!OFFICIAL_PAUSE_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]))) return false;
  return reasonsReady(chrome.reasons);
}
