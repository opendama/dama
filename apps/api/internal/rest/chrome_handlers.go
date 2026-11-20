package rest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"dama/apps/api/internal/store"
)

// OfficialPauseChrome returns DB-backed official pause ops chrome (fail closed).
func (a *PaymentsAPI) OfficialPauseChrome(w http.ResponseWriter, r *http.Request) {
	const errMsg = "official pause chrome unavailable"
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	raw, err := a.Settings.OfficialPauseChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	required := []string{
		"source", "official_pause_chrome_unavailable",
		"pause_action", "pause_pending", "resume_action", "resume_pending",
		"reason_label", "reason_placeholder", "note_label", "note_placeholder",
		"confirm_pause_title", "confirm_pause_description",
		"confirm_resume_title", "confirm_resume_description",
		"confirm_cancel", "confirm_pause", "confirm_resume",
		"toast_paused", "toast_resumed", "toast_pause_failed", "toast_resume_failed",
		"toast_meta_saved", "toast_meta_failed",
		"banner_paused_fmt", "banner_paused_note_fmt", "banner_since_fmt", "banner_resumed_fmt",
		"activity_title", "activity_empty", "activity_pause_fmt", "activity_resume_fmt", "activity_meta_fmt",
		"status_live", "status_player_pause", "status_official_pause", "status_finished",
		"col_match", "col_players", "col_status", "col_clock", "col_paused_by",
		"col_reason", "col_paused_at", "col_duration", "col_actions",
		"filter_official_paused", "filter_all",
		"role_admin_label", "role_organizer_label", "role_player_label", "clock_frozen_label",
		"meta_action", "meta_pending",
		"err_forbidden", "err_reason_required", "err_reason_invalid", "err_not_live",
		"err_already_official", "err_not_official", "err_player_resume_blocked",
		"err_game_finished", "err_note_too_long", "err_rate_limited", "err_list_failed",
		"err_meta_not_paused", "err_audit_failed", "err_update_failed",
		"bulk_pause_action", "bulk_pause_pending", "bulk_confirm_title", "bulk_confirm_description",
		"bulk_confirm", "toast_bulk_paused", "toast_bulk_partial", "toast_bulk_failed",
		"live_boards_title", "live_boards_blurb", "live_boards_empty",
		"kpi_live_official_paused", "kpi_count_separator",
		"live_search_placeholder",
		"err_bulk_round_invalid", "err_bulk_empty",
		"copy_game_id_action", "toast_copied_game_id", "col_last_action",
		// Mig 518: OpsDataTable row-actions + selection bulk (fail-closed with admin/web/Flutter chrome-ready).
		"actions_menu_label", "select_all_label", "select_row_label", "selected_count_fmt",
		"clear_selection_action",
		"bulk_selected_pause_action", "bulk_selected_pause_pending",
		"bulk_selected_confirm_title", "bulk_selected_confirm_description", "bulk_selected_confirm",
		"bulk_selected_resume_action", "bulk_selected_resume_pending",
		"bulk_selected_resume_confirm_title", "bulk_selected_resume_confirm_description",
		"bulk_selected_resume_confirm",
		"toast_bulk_resumed", "toast_bulk_resume_partial", "toast_bulk_resume_failed",
	}
	for _, key := range required {
		if !chromeValuePresent(key, asChromeString(doc[key])) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
	}
	reasons, ok := doc["reasons"].([]any)
	if !ok || len(reasons) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	for _, item := range reasons {
		m, ok := item.(map[string]any)
		if !ok {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
		if strings.TrimSpace(asChromeString(m["key"])) == "" ||
			strings.TrimSpace(asChromeString(m["label"])) == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// PlayChrome returns DB-backed play UI strings (fail closed).
func (a *PaymentsAPI) PlayChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "play chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.PlayChromeJSON(r.Context()) },
		[]string{
			"source", "page_title", "choose_mode_hint", "board_waiting", "setup_title",
			"pvp_blurb", "practice_blurb", "ai_depth_label", "depths_waiting", "depth_option_prefix",
			"play_computer_action", "practice_unavailable", "new_setup_action",
			"toast_computer_unavailable", "toast_difficulty_unavailable", "toast_practice_started",
			"toast_start_failed", "toast_load_failed", "toast_illegal_square", "toast_live_required",
			"toast_move_timeout", "toast_move_failed", "toast_live_error",
			"toast_clock_flag", "toast_clock_flag_failed",
			"you_won_on_time_message", "you_lost_on_time_message", "you_drew_on_time_message",
			"match_result_win_on_time_aria", "match_result_loss_on_time_aria", "match_result_draw_on_time_aria",
			"notif_result_win_on_time", "notif_result_loss_on_time", "notif_result_draw_on_time",
			"status_draw", "status_draw_reason_prefix", "status_p1_wins", "status_p2_wins",
			"status_multi_capture", "status_white_to_move", "status_black_to_move",
			"status_your_turn", "status_opponent_turn",
			"label_mode", "label_game", "label_moves", "label_halfmove", "label_rules",
			"label_pieces", "label_white", "label_black", "play_chrome_unavailable",
			"lobby_title", "lobby_modes_blurb", "find_1v1_action", "practice_depth_label",
			"practice_unavailable_short",
			"live_board_title", "match_clock_prefix", "status_prefix", "status_starting",
			"increment_suffix", "seat_meta_separator", "toast_options_load_failed",
			"status_matched", "status_ws_prefix", "status_synced_moves_prefix",
			"toast_ai_depth_required", "status_started", "toast_ws_connection_error",
			"status_draw_reason_open", "status_draw_reason_close",
			"paren_open", "paren_close", "increment_paren_open", "board_size_separator",
			"label_value_separator", "id_truncate_suffix", "id_truncate_chars", "piece_count_separator",
			"glyph_king", "glyph_man",
			"live_label", "history_label", "status_replay",
			"game_over_title", "you_won_message", "you_lost_message", "restart_action",
			"stop_game_action", "stop_game_confirm_title", "stop_game_confirm_description",
			"stop_game_confirm_cancel", "stop_game_confirm_confirm", "stop_game_pending",
			"stop_game_success", "stop_game_failed", "captures_your_label", "captures_opponent_label",
			"pause_game_action", "resume_game_action", "pause_game_pending", "resume_game_pending",
			"toast_paused", "toast_resumed", "toast_pause_failed", "toast_resume_failed",
			"toast_auto_resumed", "pause_disabled", "game_paused_blurb",
			"pause_remaining_fmt",
			"floating_resume_label", "floating_resume_aria",
			"nav_paused_label",
			"err_pause_disabled", "err_already_paused", "err_not_paused", "err_game_paused",
			"official_paused_blurb", "official_paused_by_fmt", "official_paused_reason_fmt",
			"official_paused_note_fmt", "official_resumed_toast_fmt", "err_officially_paused",
			"pause_kind_player", "pause_kind_official",
			"pause_overlay_aria", "pause_overlay_until_resume", "player_paused_by_fmt",
			"role_player_label",
			"practice_start_pending",
			"nav_continue_label", "nav_playing_label",
			"history_skip_first", "history_skip_prev", "history_skip_next",
			"history_skip_last", "history_skip_go", "history_skip_page_of",
			"match_intro_vs_label", "match_intro_duration_ms", "match_intro_aria",
			"toast_points_awarded_fmt",
		},
	)
}

// AvatarChrome returns DB-backed avatar upload UI strings (fail closed).
func (a *PaymentsAPI) AvatarChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "avatar chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.AvatarChromeJSON(r.Context()) },
		[]string{
			"source", "avatar_chrome_unavailable", "page_title", "page_blurb",
			"choose_upload_action", "upload_action", "uploading_action",
			"upload_failed", "toast_updated", "tap_inspect_hint",
			"change_photo_aria",
			"profile_page_title", "profile_load_failed",
			"crop_canvas_unavailable", "crop_failed",
			"err_unauthorized", "err_moderation_unavailable", "err_invalid_multipart",
			"err_file_required", "err_read_failed", "err_process_failed",
			"err_media_upload_unavailable", "err_invalid_image", "err_save_failed",
			"err_serve_forbidden",
		},
	)
}

// MediaUploadChrome returns shared drag/drop media upload UI strings (fail closed).
func (a *PaymentsAPI) MediaUploadChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "media upload unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.MediaUploadChromeJSON(r.Context()) },
		[]string{
			"media_upload_unavailable", "drop_title", "drop_hint", "browse_action",
			"replace_action", "remove_action", "uploading_label", "selected_label",
		},
	)
}

// SpectateChrome returns DB-backed spectate UI strings (fail closed).
func (a *PaymentsAPI) SpectateChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "spectate chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.SpectateChromeJSON(r.Context()) },
		[]string{
			"source", "spectate_chrome_unavailable", "page_title", "page_blurb", "page_blurb_web",
			"game_id_required", "game_id_label", "game_id_placeholder",
			"waiting_game_state", "enter_game_prompt", "unable_to_spectate", "load_game_failed",
			"start_action", "connect_action", "listening_action", "disconnect_action", "connect_title",
			"waiting_board", "board_after_connect", "board_after_connect_web",
			"connecting_status", "disconnected_status",
			"status_draw", "status_draw_reason_prefix", "status_p1_wins", "status_p2_wins",
			"status_p1_wins_on_time", "status_p2_wins_on_time", "status_draw_on_time",
			"status_white_to_move", "status_black_to_move",
			"event_log_title", "no_events", "status_live_moves_prefix",
			"status_draw_reason_open", "status_draw_reason_close",
			"glyph_king", "glyph_man",
			"live_label", "history_label", "status_replay", "seat_meta_separator",
			"status_your_turn", "status_opponent_turn", "label_white", "label_black",
			"vote_section_title", "vote_pick_action", "vote_locked_label", "vote_sign_in",
			"vote_unavailable", "vote_cast_failed", "vote_casting_pending", "vote_percent_suffix", "vote_count_suffix",
			"vote_correct_title", "vote_correct_empty", "vote_correct_blurb",
			"vote_meta_separator", "viewers_overflow_prefix", "vote_players_cannot",
			"country_flag_image_url_template",
			"watch_tab_moves", "watch_tab_chat", "watch_tab_info",
			"watch_panel_back_action", "watch_panel_back_aria", "vote_score_separator",
			"observing_game_label", "chat_disabled_label", "chat_enabled_label",
			"chat_disable_action", "chat_enable_action", "chat_disable_pending", "chat_enable_pending",
			"chat_input_placeholder", "chat_send_action", "chat_sending",
			"chat_reply_action", "chat_reply_cancel", "chat_attach_image_aria",
			"chat_empty", "chat_image_only_hint", "chat_toast_disabled",
			"chat_toast_send_failed", "chat_toast_toggle_failed", "chat_emoji_aria",
			"chat_join_required_label", "chat_load_failed_label",
			"chat_emoji_search_placeholder", "chat_emoji_search_empty", "chat_emoji_results_prefix",
			"chat_react_action", "chat_react_more_aria", "chat_you_label", "chat_reply_label",
			"chat_receipt_sent_aria", "chat_receipt_seen_aria", "chat_seen_by_prefix",
			"chat_image_fallback_label",
			"chat_receipt_sent_glyph", "chat_receipt_read_glyph", "chat_seen_count_glyph",
			"chat_receipt_pending_aria", "chat_receipt_pending_glyph",
			"chat_receipt_failed_aria", "chat_receipt_failed_glyph",
			"chat_receipt_retry_action",
			"chat_receipt_delivered_aria", "chat_receipt_delivered_glyph",
			"chat_media_lightbox_title", "chat_media_lightbox_close_aria",
			"chat_date_today", "chat_date_yesterday",
			"match_intro_vs_label", "match_intro_duration_ms", "match_intro_aria",
		},
	)
}

// LeaderboardChrome returns DB-backed leaderboard UI strings (fail closed).
func (a *PaymentsAPI) LeaderboardChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "leaderboard chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.LeaderboardChromeJSON(r.Context()) },
		[]string{
			"source", "leaderboard_chrome_unavailable", "page_title", "page_blurb",
			"empty", "load_failed", "online_label", "playing_label", "offline_label", "inspect_aria_prefix",
			"wins_abbr", "losses_abbr", "draws_abbr", "stats_separator", "meta_separator",
			"rank_prefix", "xp_suffix",
			"hall_of_fame_title", "period_week", "period_month", "period_year", "period_all",
			"default_period", "list_page_size",
			"pts_suffix", "your_rank_prefix", "view_full_leaderboard",
			"podium_first_aria", "podium_second_aria", "podium_third_aria", "rank_list_title",
			"unranked_label", "podium_first_crown", "podium_second_crown", "podium_third_crown",
			"country_flag_image_url_template",
		},
	)
}

// ThemeChrome returns DB-backed theme toggle UI strings (fail closed).
func (a *PaymentsAPI) ThemeChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "theme chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.ThemeChromeJSON(r.Context()) },
		[]string{
			"source", "theme_chrome_unavailable", "aria_label",
			"label_system", "label_light", "label_dark", "label_system_resolved_prefix",
			"aria_template", "title_template",
			"resolved_paren_open", "resolved_paren_close",
		},
	)
}

// EventsOrganizerChrome returns DB-backed hosted events organizer chrome (fail closed).
func (a *PaymentsAPI) EventsOrganizerChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "events organizer chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.EventsOrganizerChromeJSON(r.Context()) },
		[]string{
			"source", "events_organizer_chrome_unavailable", "brand_name",
			"dashboard_title", "dashboard_blurb", "list_title", "list_blurb",
			"create_action", "create_pending", "create_title", "create_blurb", "title_label", "title_placeholder",
			"format_label", "size_label", "entry_fee_label", "entry_fee_placeholder", "entry_free_label", "host_fee_label",
			"max_players_label", "unlimited_players_label",
			"pay_create_action", "join_code_label",
			"join_link_label", "copy_code_action", "copy_link_action", "copied_blurb", "toast_copy_failed",
			"download_qr_action", "toast_qr_download_failed",
			"start_action", "start_game_action",
			"forfeit_action", "forfeit_pending", "toast_forfeit_failed",
			"rematch_action", "rematch_pending", "toast_rematch_failed",
			"official_pause_action", "official_pause_pending",
			"official_resume_action", "official_resume_pending",
			"toast_official_paused", "toast_official_resumed",
			"toast_official_pause_failed", "toast_official_resume_failed",
			"official_pause_status_label",
			"approve_action", "reject_action", "kick_action", "feature_disabled",
			"insufficient_host_fee", "qr_unavailable", "toast_create_failed",
			"toast_created", "toast_started", "toast_start_failed", "toast_saved", "toast_save_failed",
			"search_label", "search_placeholder", "status_filter_label", "filter_status_all",
			"filter_all_label", "filter_free_label", "filter_paid_label", "filter_entry_label",
			"overview_tab", "join_tab", "players_tab", "bracket_tab", "branding_tab", "results_tab",
			"winners_title", "share_result_action", "bracket_title", "open_match_action",
			"auto_approve_label", "toast_cancelled",
			"brand_color_label", "brand_color_placeholder", "logo_label",
			"sponsor_name_label", "sponsor_name_placeholder", "sponsor_logo_label",
			"description_label", "description_placeholder",
			"prize_media_section_title", "prize_media_section_blurb",
			"thumbnail_label", "gallery_label", "gallery_add_action", "gallery_empty",
			"thumbnail_upload_action", "thumbnail_upload_pending", "gallery_upload_pending",
			"toast_thumbnail_saved", "toast_gallery_saved", "media_upload_failed",
			"gallery_max_slots", "gallery_slots_fmt", "thumbnail_main_badge",
			"thumbnail_empty_hint", "thumbnail_hint", "gallery_limit_reached",
			"upload_logo_action", "upload_sponsor_action",
			"meta_separator", "amount_currency_separator",
			"bracket_bye_label", "bracket_vs_label", "bracket_empty_seat",
			"kpi_active_label", "kpi_upcoming_label", "kpi_players_week_label",
			"kpi_paused_boards_label", "kpi_paused_avg_label",
			"kpi_host_fee_revenue_label", "kpi_entry_fee_revenue_label", "kpi_last_share_label",
			"kpi_entry_fee_gross_label", "kpi_entry_fee_commission_label", "kpi_entry_fee_net_label",
			"live_paused_section_title", "activity_section_title",
			"commission_percent_label", "commission_blurb_template",
			"payments_commission_label", "payments_organizer_net_label",
			"analytics_title", "analytics_blurb", "analytics_players_label",
			"analytics_completion_label", "analytics_started_label",
			"analytics_host_fee_label", "analytics_entry_fees_label", "analytics_empty",
			"analytics_metrics_note", "analytics_commission_label", "analytics_entry_net_label",
			"patch_title_locked",
			"save_action", "save_pending",
			"upload_logo_failed", "upload_sponsor_failed",
			"payments_tab", "live_board_tab", "host_fee_paid_label",
			"entry_fees_collected_label", "entry_fees_gross_label",
			"payments_commission_label", "payments_organizer_net_label",
			"copy_invite_action", "invite_text_template",
			"visibility_label", "visibility_private_label", "visibility_public_label",
			"visibility_private_blurb", "visibility_public_blurb", "public_disabled",
			"public_rated_on_blurb", "public_rated_off_blurb",
			"make_public_action", "make_private_action", "visibility_change_blocked",
			"report_action", "report_title", "report_reason_label", "report_note_label",
			"report_submit_action", "report_toast_sent", "report_toast_failed",
			"portal_wallet_label", "portal_receipts_label", "portal_transactions_label",
			"portal_overview_label", "portal_create_label", "portal_public_list_label",
			"portal_money_section_title", "portal_payout_label", "portal_payout_blurb",
			"portal_wallet_href", "portal_receipts_href", "portal_transactions_href",
			"portal_payout_href",
			"portal_overview_href", "portal_create_href", "portal_public_list_href",
			"public_list_title", "public_list_blurb", "public_list_empty",
			"join_open_action", "force_auto_approve_note",
			"close_action", "reopen_action", "cannot_reopen_blurb",
			"toast_closed", "toast_reopened", "toast_close_failed", "toast_reopen_failed",
			"auto_closed_badge", "cancel_action", "dialog_close_label", "manage_action",
			"select_all_label", "select_row_label", "selected_count_fmt", "clear_selection_action",
			"row_actions_label", "bulk_close_action", "bulk_reopen_action", "bulk_action_pending",
			"empty_list", "list_page_size", "empty_value", "top_up_action", "top_up_href",
			"standings_title", "standings_played_label", "standings_wins_label",
			"standings_losses_label", "standings_points_label",
			"group_label_template", "swiss_round_label_template",
			"result_card_share_image_action", "result_card_download_action",
			"result_card_filename",
			"result_card_image_failed", "result_card_sponsor_prefix",
			"result_card_bg_color", "result_card_fg_color", "result_card_muted_color",
			"result_card_row_wash_color",
			"result_card_title_font", "result_card_winners_font", "result_card_sponsor_font",
			"result_card_placement_font", "result_card_name_font",
			"result_card_header_wash_alpha",
			"result_card_width", "result_card_row_height", "result_card_header_height",
			"result_card_sponsor_height", "result_card_placements_max", "result_card_row_radius",
			"result_card_pad", "result_card_logo_size", "result_card_title_y", "result_card_winners_y",
			"result_card_body_gap", "result_card_rows_top_gap", "result_card_bottom_pad",
			"result_card_row_inset", "result_card_row_inner_gap",
			"result_card_placement_x", "result_card_name_x", "result_card_row_text_y",
			"result_card_sponsor_logo_w", "result_card_sponsor_logo_h",
			"result_card_sponsor_logo_gap", "result_card_logo_text_gap",
			"dialog_shell_max_height_ratio", "dialog_shell_max_width",
			"dialog_shell_inset_h", "dialog_shell_inset_v",
			"dialog_shell_loading_height", "branding_preview_height",
			"branding_preview_max_width", "dialog_scroll_max_height",
			"wide_dialog_max_width", "search_field_max_width",
			"list_blurb_max_width", "standings_table_min_width",
			"page_card_pad", "page_card_gap",
			"dashboard_tile_pad", "dashboard_tile_radius",
			"analytics_chip_pad_h", "analytics_chip_pad_v",
			"analytics_chip_radius",
			"phase_group_label", "phase_knockout_label",
			"phase_swiss_label", "phase_round_robin_label",
			"admin_formats_blurb",
			"players_pending_label", "players_approved_label", "players_rejected_label",
			"players_count_suffix",
			"not_organizer", "not_enough_players", "format_unavailable", "size_unavailable",
			"already_started", "cannot_join_status", "event_full",
			"prize_pool_display_label", "prize_pool_display_blurb",
			"prize_pool_guarantee_label", "prize_pool_guarantee_blurb",
			"prize_pool_guarantee_amount_label", "prize_pool_guarantee_amount_placeholder",
			"prize_pool_now_label", "prize_pool_if_full_label", "prize_pool_guaranteed_label",
			"prize_pool_frozen_blurb", "prize_pool_entry_fees_note",
			"insufficient_prize_guarantee", "prize_pool_unavailable",
			"err_prize_guarantee_amount_invalid", "err_prize_guarantee_settle_failed",
			"err_guarantee_live_cannot_release", "err_reopen_guarantee_hold_failed",
			"err_host_guarantee_requires_document_kyc", "err_host_paid_requires_phone_kyc",
			"err_host_concurrent_open_paid_cap", "err_host_reputation_blocked",
			"host_trust_badge_unverified", "host_trust_badge_phone_verified", "host_trust_badge_document_verified",
			"host_rep_finished_label", "host_rep_cancelled_label", "host_rep_reports_label", "host_rep_meta_separator",
			"arena_duration_label", "arena_duration_required",
			"arena_duration_unit_label", "arena_duration_unit_minutes", "arena_duration_unit_hours",
			"arena_duration_unit_days", "arena_duration_unit_weeks", "arena_duration_unit_months",
			"arena_duration_mode_length", "arena_duration_mode_ends_at",
			"arena_duration_ends_at_label", "arena_duration_ends_at_placeholder",
			"arena_duration_length_placeholder",
			"arena_duration_ends_at_past", "arena_duration_blurb",
			"toast_arena_start_failed", "toast_arena_queue_failed",
			"arena_finish_action", "arena_finish_pending", "toast_arena_finished", "toast_arena_finish_failed",
			"arena_finish_requires_started", "arena_finish_already_finished",
			"payout_mode_label", "payout_mode_blurb", "payout_mode_places_percent_label", "payout_mode_score_share_label",
			"payout_mode_dual_purse_label",
			"prize_place_percents_section_label", "prize_place_percents_blurb",
			"prize_place_percent_1_label", "prize_place_percent_2_label", "prize_place_percent_3_label",
			"prize_place_percent_1_placeholder", "prize_place_percent_2_placeholder", "prize_place_percent_3_placeholder",
			"err_prize_place_percents_sum", "err_payout_mode_invalid", "err_payout_mode_score_share_knockout",
		},
	)
}

// EventsPlayerChrome returns DB-backed hosted events player chrome (fail closed).
func (a *PaymentsAPI) EventsPlayerChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "events player chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.EventsPlayerChromeJSON(r.Context()) },
		[]string{
			"source", "events_player_chrome_unavailable", "join_title", "join_blurb",
			"page_title", "page_blurb", "empty_web", "detail_unavailable",
			"code_label", "code_placeholder", "join_action", "event_full", "event_not_joinable",
			"watch_action", "results_action", "lobby_action",
			"already_joined", "pending_approval", "approved_blurb",
			"rejected_blurb", "kicked_blurb", "spectate_action", "feature_disabled",
			"public_disabled",
			"load_failed", "insufficient_entry_fee", "top_up_action", "top_up_href",
			"meta_separator", "bracket_bye_label", "bracket_vs_label", "bracket_empty_seat",
			"bracket_title",
			"entry_fee_pay_blurb", "events_player_chrome_unavailable",
			"report_action", "report_title", "report_reason_label", "report_note_label",
			"report_submit_action", "report_toast_sent", "report_toast_failed",
			"public_list_title", "public_list_blurb", "public_list_empty",
			"visibility_private_blurb", "visibility_public_blurb",
			"public_rated_on_blurb", "public_rated_off_blurb",
			"winners_title", "share_result_action",
			"list_page_size", "empty_value", "players_count_suffix",
			"amount_currency_separator",
			"filter_all_label", "filter_free_label", "filter_paid_label", "filter_entry_label",
			"filter_lifecycle_label", "filter_lifecycle_open_label", "filter_lifecycle_live_label",
			"filter_lifecycle_finished_label", "filter_mine_label",
			"empty_lifecycle_open", "empty_lifecycle_live", "empty_lifecycle_finished", "empty_mine",
			"search_label", "search_placeholder",
			"filters_toggle_label", "filters_toggle_show_aria", "filters_toggle_hide_aria",
			"search_debounce_ms",
			"hosted_by_label", "carousel_aria", "free_label", "players_label", "entry_label",
			"detail_description_label",
			"view_action", "share_action", "detail_join_action",
			"join_code_section_title", "join_code_section_blurb",
			"roster_title", "format_label", "size_label", "unlimited_players_label",
			"dialog_close_label", "cancel_action",
			"standings_title", "standings_played_label", "standings_wins_label",
			"standings_losses_label", "standings_points_label",
			"group_label_template", "swiss_round_label_template",
			"phase_group_label", "phase_knockout_label",
			"phase_swiss_label", "phase_round_robin_label",
			"result_card_share_image_action", "result_card_download_action",
			"result_card_filename",
			"result_card_image_failed", "result_card_sponsor_prefix",
			"result_card_bg_color", "result_card_fg_color", "result_card_muted_color",
			"result_card_row_wash_color",
			"result_card_title_font", "result_card_winners_font", "result_card_sponsor_font",
			"result_card_placement_font", "result_card_name_font",
			"result_card_header_wash_alpha",
			"result_card_width", "result_card_row_height", "result_card_header_height",
			"result_card_sponsor_height", "result_card_placements_max", "result_card_row_radius",
			"result_card_pad", "result_card_logo_size", "result_card_title_y", "result_card_winners_y",
			"result_card_body_gap", "result_card_rows_top_gap", "result_card_bottom_pad",
			"result_card_row_inset", "result_card_row_inner_gap",
			"result_card_placement_x", "result_card_name_x", "result_card_row_text_y",
			"result_card_sponsor_logo_w", "result_card_sponsor_logo_h",
			"result_card_sponsor_logo_gap", "result_card_logo_text_gap",
			"dialog_shell_max_height_ratio", "dialog_shell_max_width",
			"dialog_shell_inset_h", "dialog_shell_inset_v",
			"dialog_shell_loading_height", "branding_preview_height",
			"branding_preview_max_width", "dialog_scroll_max_height",
			"panel_max_width", "browse_max_width",
			"standings_table_min_width",
			"page_card_pad", "page_card_gap",
			"prize_pool_now_label", "prize_pool_if_full_label", "prize_pool_guaranteed_label",
			"prize_pool_frozen_blurb", "prize_pool_entry_fees_note",
			"host_trust_badge_unverified", "host_trust_badge_phone_verified", "host_trust_badge_document_verified",
			"host_rep_finished_label", "host_rep_cancelled_label", "host_rep_reports_label", "host_rep_meta_separator",
			"lobby_title", "lobby_blurb", "lobby_unavailable", "lobby_roster_title",
			"lobby_bracket_title", "lobby_standings_title", "lobby_next_match_title",
			"lobby_waiting_start", "lobby_open_play_action",
			"lobby_poll_interval_ms",
			"check_in_action", "check_in_pending", "check_in_done", "check_in_closed",
			"check_in_not_open", "check_in_success", "check_in_required_blurb",
			"ready_action", "ready_pending", "ready_done", "ready_waiting_opponent", "ready_success",
			"ready_timeout_blurb",
			"prize_settled_blurb", "prize_pending_blurb", "dispute_window_blurb",
			"arena_lobby_title", "arena_lobby_blurb", "arena_queue_action", "arena_queue_pending",
			"arena_queue_done", "arena_leave_queue_action", "arena_leave_queue_pending",
			"arena_clock_label", "arena_points_label", "arena_streak_label", "arena_standings_title",
			"arena_waiting_pair", "arena_finished_blurb", "arena_not_started_blurb", "arena_left_blurb",
			"est_prize_share_label", "est_prize_share_blurb",
			"toast_points_awarded_fmt",
			"toast_arena_queue_failed", "toast_arena_start_failed",
			// Mig 392–393 player err keys (writeEventsPlayerErr / lobby toast map).
			"err_catalog_unavailable", "err_event_not_live", "err_event_not_found",
			"err_match_not_found", "err_match_not_ready", "err_players_missing",
			"qr_unavailable", "cannot_join_status",
			"err_start_failed", "err_start_game_failed", "err_unauthorized",
			"err_report_already_open", "err_report_submit_failed", "err_invalid_reason_code",
		},
	)
}

// EventsAdminChrome returns DB-backed hosted events admin catalog chrome (fail closed).
func (a *PaymentsAPI) EventsAdminChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "events admin chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.EventsAdminChromeJSON(r.Context()) },
		[]string{
			"source", "events_admin_chrome_unavailable", "page_title", "page_blurb",
			"formats_title", "sizes_title", "enabled_label",
			"format_id_label", "catalog_item_label", "catalog_item_label_blurb",
			"max_players_label",
			"allowed_formats_label",
			"join_code_length_label", "auto_approve_default_label", "force_auto_approve_note",
			"min_players_title", "min_players_label",
			"save_action", "save_pending", "toast_saved", "toast_save_failed",
			"lacks_permissions", "load_failed", "permission_key",
			"public_events_flag_label", "public_events_flag_blurb",
			"public_events_flag_key",
			"public_rated_flag_label", "public_rated_flag_blurb",
			"public_rated_flag_key",
			"prize_pool_display_flag_key", "prize_pool_display_flag_label", "prize_pool_display_flag_blurb",
			"prize_pool_guarantee_flag_key", "prize_pool_guarantee_flag_label", "prize_pool_guarantee_flag_blurb",
			"kyc_auto_approve_flag_key", "kyc_auto_approve_flag_label", "kyc_auto_approve_flag_blurb",
			"host_rep_finished_label", "host_rep_cancelled_label", "host_rep_reports_label", "host_rep_meta_separator",
			"entry_fee_commission_label", "entry_fee_commission_blurb",
			"public_host_fee_multiplier_label", "public_host_fee_multiplier_blurb",
			"reports_title", "reports_blurb", "reports_empty",
			"report_reasons_title", "report_reasons_blurb", "report_reason_code_label",
			"report_reason_col", "report_event_col", "report_reporter_col", "report_status_col",
			"dismiss_action", "deactivate_action", "toast_dismissed", "toast_deactivated",
			"reports_permission_key",
			"hosted_events_title", "hosted_events_blurb", "hosted_events_empty",
			"hosted_col_title", "hosted_col_status", "hosted_col_organizer", "hosted_col_code",
			"hosted_col_players", "hosted_col_visibility", "hosted_col_created",
			"list_page_size", "empty_value",
			"filter_all_label", "filter_free_label", "filter_paid_label", "filter_entry_label",
			"search_label", "search_placeholder",
			"formats_engine_blurb", "swiss_rounds_label", "groups_size_label", "groups_advance_label",
			"hosted_col_entry", "hosted_col_actions", "view_detail_action", "detail_modal_title",
			"detail_close_label", "detail_format_label", "detail_size_label", "detail_entry_fee_label",
			"detail_host_fee_label", "detail_commission_label", "detail_auto_approve_label",
			"detail_pending_players_label", "detail_updated_label", "detail_started_label",
			"detail_finished_label", "detail_cancelled_label", "detail_share_label",
			"detail_prize_now_label", "detail_prize_if_full_label", "detail_prize_guarantee_label",
			"detail_prize_frozen_label", "detail_sponsor_label", "detail_logo_label",
			"detail_sponsor_logo_label", "detail_yes", "detail_no",
			"detail_description_label", "detail_prize_image_label", "detail_gallery_label", "gallery_empty",
			"detail_brand_color_label", "detail_winner_label",
			"detail_players_section_title", "detail_players_section_blurb", "detail_players_col_user",
			"detail_players_col_status", "detail_players_col_checked_in", "detail_players_col_placement",
			"detail_players_col_rating", "detail_players_empty", "detail_players_open_user",
			"thumbnail_label",
			"amount_currency_separator", "search_debounce_ms",
			"select_all_label", "select_row_label", "selected_count_fmt", "clear_selection_action",
			"host_fee_geo_blurb",
			"host_fee_ethiopia_amount_label", "host_fee_ethiopia_currency_label",
			"host_fee_global_amount_label", "host_fee_global_currency_label",
			"sizes_col_ethiopia_fee", "sizes_col_global_fee", "sizes_col_max_players",
			"sizes_col_formats", "sizes_col_status", "sizes_col_id", "sizes_col_label",
			"sizes_add_action", "sizes_edit_action", "sizes_delete_action", "sizes_delete_confirm",
			"sizes_detail_title", "sizes_empty", "sizes_active_label", "sizes_inactive_label",
			"sizes_actions_label", "sizes_dialog_close_label", "sizes_cancel_action",
			"sizes_save_action", "sizes_save_pending", "sizes_delete_pending", "sizes_status_pending",
			"sizes_toast_created", "sizes_toast_updated", "sizes_toast_deleted", "sizes_toast_failed",
			"sizes_bulk_activate_action", "sizes_bulk_deactivate_action", "sizes_bulk_status_pending",
			"sizes_search_label", "sizes_search_placeholder", "sizes_sort_order_label",
			"err_size_id_required", "err_size_id_exists", "err_size_not_found", "err_host_fee_dual_required",
			"unlimited_players_label", "sizes_unlimited_toggle_label", "sizes_unlimited_blurb",
			"sizes_max_players_placeholder", "err_unlimited_arena_only",
			"err_unlimited_max_high_or_empty",
		},
	)
}

// TournamentsPlayerChrome returns DB-backed player tournament list/enroll strings (fail closed).
func (a *PaymentsAPI) TournamentsPlayerChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "tournaments chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.TournamentsPlayerChromeJSON(r.Context()) },
		[]string{
			"source", "tournaments_player_chrome_unavailable", "page_title", "page_blurb",
			"empty", "empty_web", "empty_value", "free_entry_prefix", "enroll_action", "enrolling_action",
			"join_action", "joining_action",
			"watch_action", "results_action", "lobby_action",
			"enroll_failed", "joined_free", "enrolled_charged_prefix", "enrolled_charged_close",
			"enrolled_bare", "load_failed", "meta_separator", "amount_currency_separator",
			"players_label", "prize_label", "entry_label", "free_label", "carousel_aria",
			"unlimited_players_label",
			"err_enrollable_status_unavailable", "err_load_failed",
			"err_tournament_not_found", "err_not_open_for_enrollment",
			"prize_pool_now_label", "prize_pool_if_full_label", "prize_pool_guaranteed_label",
			"prize_pool_frozen_blurb", "prize_pool_display_label", "prize_pool_entry_fees_note",
			"list_page_size",
			"filter_all_label", "filter_free_label", "filter_paid_label", "filter_entry_label",
			"filter_source_label", "filter_source_all_label", "filter_source_official_label",
			"filter_source_community_label",
			"filter_lifecycle_label", "filter_lifecycle_open_label", "filter_lifecycle_live_label",
			"filter_lifecycle_finished_label", "filter_mine_label",
			"empty_lifecycle_open", "empty_lifecycle_live", "empty_lifecycle_finished", "empty_mine",
			"my_tournaments_title", "my_tournaments_empty", "my_tournaments_open_action",
			"my_tournaments_place_label", "my_tournaments_points_label", "my_tournaments_streak_label",
			"my_tournaments_prize_label",
			"badge_official_label", "badge_community_label",
			"host_tournament_action", "host_tournament_href", "host_tournament_blurb",
			"empty_community", "empty_official",
			"search_label", "search_placeholder",
			"filters_toggle_label", "filters_toggle_show_aria", "filters_toggle_hide_aria",
			"search_debounce_ms",
			"lobby_title", "lobby_blurb", "lobby_unavailable", "lobby_roster_title",
			"lobby_bracket_title", "lobby_standings_title", "lobby_next_match_title",
			"lobby_waiting_start", "lobby_open_play_action", "lobby_spectate_action",
			"lobby_poll_interval_ms",
			"check_in_action", "check_in_pending", "check_in_done", "check_in_closed",
			"check_in_not_open", "check_in_success", "check_in_required_blurb",
			"ready_action", "ready_pending", "ready_done", "ready_waiting_opponent", "ready_success",
			"ready_timeout_blurb",
			"format_label", "prize_settled_blurb", "prize_pending_blurb", "dispute_window_blurb",
			"standings_title", "standings_played_label", "standings_wins_label",
			"standings_losses_label", "standings_points_label", "standings_table_min_width",
			"group_label_template",
			"report_action", "report_title", "report_reason_label", "report_note_label",
			"report_submit_action", "report_toast_sent", "report_toast_failed", "cancel_action",
			"err_report_already_open", "err_report_submit_failed", "err_report_not_allowed",
			"err_not_enrolled", "err_invalid_reason_code", "err_invalid_json",
			"arena_lobby_title", "arena_lobby_blurb", "arena_queue_action", "arena_queue_pending",
			"arena_queue_done", "arena_leave_queue_action", "arena_leave_queue_pending",
			"arena_clock_label", "arena_points_label", "arena_streak_label", "arena_standings_title",
			"arena_waiting_pair", "arena_finished_blurb", "arena_not_started_blurb", "arena_left_blurb",
			"est_prize_share_label", "est_prize_share_blurb",
			"toast_points_awarded_fmt",
			"toast_arena_queue_failed", "toast_arena_start_failed",
			// Play/lobby writeTournamentsPlayerErr keys (Ready / Open Play / check-in).
			"err_bracket_failed", "err_check_in_not_open", "err_check_in_closed",
			"err_start_failed", "err_match_not_found", "err_match_not_ready",
			"err_players_missing",
		},
	)
}

// HomeSurfaceChrome returns DB-backed home surface strings (fail closed).
func (a *PaymentsAPI) HomeSurfaceChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "home chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.HomeSurfaceChromeJSON(r.Context()) },
		[]string{
			"live_section_title", "live_section_blurb", "players_label", "prize_label",
			"entry_label", "free_label", "enroll_cta", "join_cta", "top_up_cta", "empty_live",
			"empty_value",
			"home_chrome_unavailable", "carousel_aria",
			"prize_pool_now_label", "prize_pool_if_full_label", "prize_pool_guaranteed_label",
			"prize_pool_frozen_blurb", "prize_pool_entry_fees_note",
			"meta_separator", "amount_currency_separator",
		},
	)
}

// AppShellChrome returns DB-backed splash, onboarding, 404, and SEO packaging strings (fail closed).
func (a *PaymentsAPI) AppShellChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "app shell chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.AppShellChromeJSON(r.Context()) },
		[]string{
			"source", "app_shell_unavailable",
			"splash_hold_ms", "splash_unavailable",
			"splash_background_color", "splash_logo_ink", "brand_mark_alt",
			"not_found_code", "not_found_title", "not_found_blurb",
			"not_found_home_action", "not_found_home_href",
			"onboarding_unavailable", "skip_action", "next_action", "done_action",
			"slide_1_title", "slide_1_blurb",
			"slide_2_title", "slide_2_blurb",
			"slide_3_title", "slide_3_blurb",
			"og_image_path", "favicon_light_path", "favicon_dark_path", "apple_touch_icon_path",
			"manifest_name", "manifest_short_name", "manifest_description", "manifest_theme_color",
			"manifest_background_color_light", "manifest_background_color_dark",
			"twitter_card", "robots_index", "admin_robots", "admin_not_found_home_href",
		},
	)
}

// PlatformStatsChrome returns DB-backed public community stats labels (fail closed).
func (a *PaymentsAPI) PlatformStatsChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "platform stats chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.PlatformStatsChromeJSON(r.Context()) },
		[]string{
			"source", "platform_stats_unavailable", "section_title", "section_blurb",
			"period_label", "period_day_label", "period_week_label", "period_month_label",
			"period_year_label", "kpi_online_now", "kpi_playing_now", "kpi_users_total",
			"kpi_visited", "kpi_played", "kpi_games_finished", "kpi_dau", "kpi_wau", "kpi_mau",
			// Usage chart chrome (mig 178) - fail closed if missing so chrome GET matches stats enrich.
			"series_title", "series_subtitle", "series_y_axis", "series_empty",
			"series_legend_aria", "series_today_label",
			"series_visited_label", "series_played_label", "series_games_label",
			"series_visited_color", "series_played_color", "series_games_color",
			"heatmap_title", "heatmap_empty", "heatmap_total_label",
			"heatmap_stat_longest_streak", "heatmap_stat_current_streak",
			"heatmap_stat_peak_day", "heatmap_stat_peak_month", "heatmap_streak_unit",
			"cumulative_title", "cumulative_empty", "cumulative_series_label",
			"breakdown_modes_title", "breakdown_modes_empty",
			"breakdown_outcomes_title", "breakdown_outcomes_empty", "breakdown_outcomes_meta_fmt",
			"outcome_decisive_label", "outcome_draw_label",
			"breakdown_entry_title", "breakdown_entry_empty",
			"entry_free_label", "entry_paid_label",
		},
	)
}

// PaymentModalChrome returns DB-backed payment/enroll modal strings (fail closed).
func (a *PaymentsAPI) PaymentModalChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "payment modal chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.PaymentModalChromeJSON(r.Context()) },
		[]string{
			"title", "blurb", "balance_label", "fee_label", "confirm_action", "cancel_action",
			"insufficient_title", "insufficient_blurb", "top_up_action", "top_up_href", "methods_title",
			"methods_blurb", "checkout_action", "amount_label", "amount_placeholder",
			"balance_pending", "country_required_hint",
			"payment_modal_unavailable",
			"enroll_success", "enroll_failed", "already_enrolled",
			"confirm_pending", "checkout_pending",
			"amount_currency_separator",
		},
	)
}

// OTPChrome returns DB-backed OTP gate UI strings (fail closed).
func (a *PaymentsAPI) OTPChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "otp chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.OTPChromeJSON(r.Context()) },
		[]string{
			"source", "otp_chrome_unavailable", "verify_title", "start_failed", "invalid_code",
			"enter_code_blurb", "enter_code_blurb_web", "flags_unavailable", "verification_start_failed",
			"code_label", "code_placeholder", "retry_action", "retry_otp_action",
			"starting_action", "verify_action", "verifying_action",
			"err_unauthorized", "err_not_required", "err_challenge_required",
			"err_verification_required", "err_verification_unavailable",
		},
	)
}

// ProfileInspectChrome returns DB-backed public player inspect modal strings (fail closed).
func (a *PaymentsAPI) ProfileInspectChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "profile inspect chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.ProfileInspectChromeJSON(r.Context()) },
		[]string{
			"source", "profile_inspect_chrome_unavailable", "load_failed", "sr_description",
			"inspect_action", "zoom_title", "no_avatar", "avatar_alt_suffix",
			"label_rating", "label_xp", "label_level", "label_wins", "label_losses", "label_draws",
			"label_country", "label_region", "label_regional_rank", "top_prefix",
			"recent_matches_title", "no_matches", "tournament_placements_title", "no_placements",
			"outcome_draw", "outcome_win", "outcome_loss", "free_suffix",
			"pieces_left_suffix", "captured_suffix", "seat_meta_separator", "stats_separator",
			"label_value_separator", "flag_code_separator", "rank_parts_separator",
			"page_title", "zoom_hint", "wld_label", "moves_suffix", "player_unavailable",
			"friends_count_label", "online_now_label", "offline_now_label", "playing_now_label",
			"overview_tab", "games_tab",
			"game_history_players_col", "game_history_result_col", "game_history_moves_col",
			"game_history_date_col", "friends_section_title", "joined_label",
			"no_friends", "empty_value",
			"list_page_size",
			"country_flag_image_url_template",
			"host_trust_badge_unverified", "host_trust_badge_phone_verified", "host_trust_badge_document_verified",
			"host_rep_finished_label", "host_rep_cancelled_label", "host_rep_reports_label", "host_rep_meta_separator",
		},
	)
}

// TournamentChrome returns DB-backed admin tournament create UI strings (fail closed).
func (a *PaymentsAPI) TournamentChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "tournament chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.TournamentChromeJSON(r.Context()) },
		[]string{
			"source", "page_title", "tab_list_label", "tab_live_boards_label", "page_blurb", "title_label", "title_placeholder",
			"detail_players_section_title", "detail_players_section_blurb", "detail_players_col_user",
			"detail_players_col_status", "detail_players_col_checked_in", "detail_players_col_placement",
			"detail_players_empty",
			"detail_players_open_user",
			"description_label", "description_placeholder",
			"make_free_label", "entry_currency_label", "entry_amount_label",
			"entry_fee_required", "title_required",
			"prize_amount_label", "prize_currency_label", "prize_placeholder", "create_action",
			"existing_title", "is_free_prefix", "prize_prefix",
			"is_free_true", "is_free_false", "meta_separator",
			"amount_currency_separator", "free_entry_amount",
			"toast_created", "toast_create_failed", "toast_status_updated", "toast_status_failed",
			"tournament_chrome_unavailable", "empty_value", "list_page_size",
			"err_load_failed", "err_status_required", "err_invalid_status", "err_status_update_failed",
			"err_media_unavailable", "err_invalid_multipart", "err_file_required", "err_read_failed",
			"err_upload_failed", "err_tournament_not_found",
			"prize_pool_display_label", "prize_pool_display_blurb", "prize_pool_max_players_label",
			"unlimited_players_label", "prize_pool_max_players_unlimited_blurb",
			"err_unlimited_arena_only", "err_max_players_required",
			"prize_pool_now_label", "prize_pool_if_full_label", "prize_pool_guaranteed_label",
			"prize_pool_frozen_blurb", "prize_pool_entry_fees_note",
			"filter_all_label", "filter_free_label", "filter_paid_label", "filter_entry_label",
			"search_label", "search_placeholder",
			"actions_label", "col_title", "col_entry", "col_status", "col_prize", "col_actions",
			"view_detail_action", "edit_action", "delete_action", "cancel_action",
			"dialog_close_label", "save_action", "save_pending",
			"create_modal_title", "edit_modal_title", "detail_modal_title", "detail_close_label",
			"delete_confirm", "toast_updated", "toast_update_failed", "toast_deleted", "toast_delete_failed",
			"err_update_failed", "err_delete_failed", "search_debounce_ms",
			"status_field_label", "created_at_label", "empty_list",
			"create_pending", "status_update_pending",
			"select_all_label", "select_row_label", "selected_count_fmt", "clear_selection_action",
			"thumbnail_label", "gallery_label", "gallery_add_action", "gallery_empty",
			"thumbnail_upload_action", "thumbnail_upload_pending", "gallery_upload_pending",
			"toast_thumbnail_saved", "toast_gallery_saved", "media_upload_failed",
			"gallery_max_slots", "gallery_slots_fmt", "thumbnail_main_badge",
			"thumbnail_empty_hint", "thumbnail_hint", "gallery_limit_reached",
			"format_label", "format_required", "start_cup_action", "start_cup_pending",
			"force_start_match_action", "settle_prizes_action", "settle_prizes_pending",
			"settle_prizes_success_fmt", "settle_prizes_none_due", "settle_prizes_failed",
			"settle_prizes_requires_finished", "settle_prizes_already_settled",
			"forfeit_action", "forfeit_pending",
			"rematch_action", "rematch_pending",
			"official_pause_action", "official_pause_pending",
			"official_resume_action", "official_resume_pending",
			"toast_official_paused", "toast_official_resumed",
			"toast_official_pause_failed", "toast_official_resume_failed",
			"official_pause_status_label",
			"control_room_title", "check_in_window_label",
			"not_enough_players", "err_refund_failed",
			"err_cup_already_started", "status_after_start_blurb", "err_bracket_exists", "err_start_failed",
			"err_forfeit_failed", "err_rematch_failed", "err_match_not_found", "err_match_not_ready",
			"reports_title", "reports_blurb", "reports_empty",
			"report_reason_col", "report_tournament_col", "report_reporter_col", "report_status_col",
			"dismiss_action", "resolve_action", "toast_dismissed", "toast_resolved",
			"err_report_not_found", "err_reports_failed", "err_dismiss_failed", "err_resolve_failed",
			"arena_duration_label", "arena_duration_required",
			"arena_duration_unit_label", "arena_duration_unit_minutes", "arena_duration_unit_hours",
			"arena_duration_unit_days", "arena_duration_unit_weeks", "arena_duration_unit_months",
			"arena_duration_mode_length", "arena_duration_mode_ends_at",
			"arena_duration_ends_at_label", "arena_duration_ends_at_placeholder",
			"arena_duration_length_placeholder",
			"arena_duration_ends_at_past", "arena_duration_blurb",
			"err_arena_start_failed", "err_arena_queue_failed",
			"arena_settings_title", "arena_settings_blurb", "arena_settings_save_action", "arena_settings_save_pending",
			"arena_settings_toast_saved", "arena_settings_toast_failed",
			"arena_settings_label_points_win", "arena_settings_label_points_draw", "arena_settings_label_points_loss",
			"arena_settings_label_streak_second", "arena_settings_label_streak_third_plus",
			"arena_settings_label_default_duration", "arena_settings_label_pairing_mode",
			"arena_settings_label_auto_start", "arena_settings_label_pair_interval",
			"arena_settings_label_allow_join_while_live",
			"arena_finish_action", "arena_finish_pending", "toast_arena_finished", "toast_arena_finish_failed",
			"arena_finish_requires_started", "arena_finish_already_finished",
			"prize_settle_settings_title", "prize_settle_settings_blurb",
			"prize_settle_settings_save_action", "prize_settle_settings_save_pending",
			"prize_settle_settings_toast_saved", "prize_settle_settings_toast_failed",
			"prize_settle_label_auto_settle", "prize_settle_label_dispute_hours",
			"prize_settle_label_interval_minutes", "prize_settle_auto_settle_blurb",
			"dispute_window_ends_at_label", "dispute_window_not_open_value",
			"prize_settled_at_label", "prize_not_settled_value",
			"payout_default_format_knockout_label", "payout_default_format_round_robin_label",
			"payout_default_format_swiss_label", "payout_default_format_groups_knockout_label",
			"payout_default_format_arena_label",
			"projected_payout_section_label", "projected_payout_blurb",
			"prize_places_section_label", "prize_place_1_label", "prize_place_2_label", "prize_place_3_label",
			"prize_places_blurb", "err_prize_places_sum",
			"payout_mode_label", "payout_mode_blurb", "payout_mode_places_percent_label", "payout_mode_score_share_label",
			"payout_mode_dual_purse_label", "dual_purse_place_percent_label", "dual_purse_place_percent_blurb",
			"prize_place_percents_section_label", "prize_place_percents_blurb",
			"prize_place_percent_1_label", "prize_place_percent_2_label", "prize_place_percent_3_label",
			"prize_place_percent_1_placeholder", "prize_place_percent_2_placeholder", "prize_place_percent_3_placeholder",
			"err_prize_place_percents_sum", "err_payout_mode_invalid", "err_payout_mode_score_share_knockout",
			"standings_settings_title", "standings_settings_blurb",
			"standings_settings_label_points_win", "standings_settings_label_points_draw",
			"standings_settings_save_action", "standings_settings_save_pending",
			"standings_settings_toast_saved", "standings_settings_toast_failed",
			"payout_settings_title", "payout_settings_blurb",
			"payout_settings_save_action", "payout_settings_save_pending",
			"payout_settings_toast_saved", "payout_settings_toast_failed",
			"points_toast_settings_title", "points_toast_settings_blurb",
			"points_toast_settings_label_arena_points", "points_toast_settings_label_standings_points",
			"points_toast_settings_label_toast_fmt", "points_toast_settings_label_notif_title",
			"points_toast_settings_label_notif_body", "points_toast_settings_notif_body_blurb",
			"points_toast_settings_save_action", "points_toast_settings_save_pending",
			"points_toast_settings_toast_saved", "points_toast_settings_toast_failed",
		},
	)
}

// CountryFlagChrome returns DB-backed flag image URL template (fail closed; `{code}` = ISO-2).
func (a *PaymentsAPI) CountryFlagChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "country flag chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.CountryFlagChromeJSON(r.Context()) },
		[]string{
			"source", "image_url_template", "country_flag_chrome_unavailable",
		},
	)
}

// ChatEmojiCatalog returns DB-backed Telegram-style emoji categories (fail closed).
func (a *PaymentsAPI) ChatEmojiCatalog(w http.ResponseWriter, r *http.Request) {
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
		return
	}
	raw, err := a.Settings.ChatEmojiCatalogJSON(r.Context())
	if err != nil || len(raw) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
		return
	}
	var doc struct {
		Categories []struct {
			ID     string `json:"id"`
			Label  string `json:"label"`
			Icon   string `json:"icon"`
			Emojis []struct {
				Glyph    string `json:"glyph"`
				Keywords string `json:"keywords"`
			} `json:"emojis"`
		} `json:"categories"`
		QuickReactions []string `json:"quick_reactions"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
		return
	}
	if len(doc.Categories) == 0 || len(doc.QuickReactions) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
		return
	}
	emojiCount := 0
	for _, c := range doc.Categories {
		if strings.TrimSpace(c.ID) == "" || strings.TrimSpace(c.Label) == "" || strings.TrimSpace(c.Icon) == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
			return
		}
		if len(c.Emojis) == 0 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
			return
		}
		for _, e := range c.Emojis {
			if strings.TrimSpace(e.Glyph) == "" {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
				return
			}
			emojiCount++
		}
	}
	for _, q := range doc.QuickReactions {
		if strings.TrimSpace(q) == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
			return
		}
	}
	if emojiCount == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "chat emoji catalog unavailable"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// PlayRailChrome returns DB-backed Play hub right-rail strings (fail closed).
func (a *PaymentsAPI) PlayRailChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "play rail chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.PlayRailChromeJSON(r.Context()) },
		[]string{
			"source", "tab_new_game", "tab_games", "tab_players",
			"country_flag_image_url_template",
			"sub_play_ai", "sub_challenge", "sub_watch", "sub_history",
			"sub_friends", "sub_all_players", "sub_friend_requests", "sub_dms",
			"dms_requests_count_aria", "message_action",
			"dm_modal_title", "dm_send_action", "dm_sending", "dm_input_placeholder",
			"dm_empty_requests", "dm_request_pending_label", "dm_request_outgoing_label",
			"dm_request_denied_label", "dm_request_cancelled_label",
			"dm_unread_badge_max", "dm_unread_badge_overflow_fmt", "dms_unread_count_aria",
			"dm_accept_action", "dm_accepting",
			"dm_deny_action", "dm_denying", "dm_cancel_action", "dm_cancelling",
			"dm_preview_max_chars", "dm_preview_truncate_suffix", "dm_image_preview_label",
			"chat_reply_preview_max_chars", "chat_loading", "dm_chat_loading",
			"chat_poll_interval_ms", "dm_poll_interval_ms", "dm_requests_poll_interval_ms",
			"more_options_aria", "chat_emoji_set",
			"dm_toast_sent", "dm_toast_accepted", "dm_toast_denied", "dm_toast_cancelled",
			"dm_toast_failed", "dm_chat_empty", "dm_reply_action", "dm_reply_cancel",
			"dm_attach_image_aria", "dm_emoji_aria", "dm_words_label",
			"remove_image_aria",
			"watch_tab_moves", "watch_tab_chat", "watch_tab_info",
			"watch_panel_back_action", "watch_panel_back_aria", "vote_score_separator",
			"observing_game_label", "chat_disabled_label", "chat_enabled_label",
			"chat_disable_action", "chat_enable_action", "chat_disable_pending", "chat_enable_pending",
			"chat_input_placeholder", "chat_send_action", "chat_sending",
			"chat_reply_action", "chat_reply_cancel", "chat_attach_image_aria",
			"chat_empty", "chat_image_only_hint", "chat_toast_disabled",
			"chat_toast_send_failed", "chat_toast_toggle_failed", "chat_emoji_aria",
			"chat_join_required_label", "chat_load_failed_label", "dm_open_failed",
			"dm_load_failed_label",
			"chat_emoji_search_placeholder", "chat_emoji_search_empty", "chat_emoji_results_prefix",
			"chat_react_action", "chat_react_more_aria", "chat_you_label", "chat_reply_label",
			"chat_receipt_sent_aria", "chat_receipt_seen_aria", "chat_seen_by_prefix",
			"chat_image_fallback_label",
			"chat_receipt_sent_glyph", "chat_receipt_read_glyph", "chat_seen_count_glyph",
			"chat_receipt_pending_aria", "chat_receipt_pending_glyph",
			"chat_receipt_failed_aria", "chat_receipt_failed_glyph",
			"chat_receipt_retry_action",
			"chat_receipt_delivered_aria", "chat_receipt_delivered_glyph",
			"chat_media_lightbox_title", "chat_media_lightbox_close_aria",
			"chat_date_today", "chat_date_yesterday",
			"match_intro_vs_label", "match_intro_duration_ms", "match_intro_aria",
			"match_result_win_on_time_aria", "match_result_loss_on_time_aria", "match_result_draw_on_time_aria",
			"label_opponent", "label_time", "label_i_play_as", "label_rated", "label_unrated",
			"label_colors", "label_board", "label_pieces", "label_rating",
			"search_username_placeholder", "search_opponent_placeholder",
			"send_challenge_action", "sending_challenge", "challenge_link_action",
			"copied_action", "copied_share_blurb", "sign_in_to_challenge",
			"find_matchmaking_action", "watch_game_action", "challenge_action",
			"add_friend_action", "remove_friend_action",
			"send_friend_request_action", "sending_friend_request",
			"accept_friend_request_action", "accepting_friend_request",
			"deny_friend_request_action", "denying_friend_request",
			"cancel_friend_request_action", "cancelling_friend_request",
			"friend_request_pending_label", "friend_request_outgoing_label",
			"friend_request_denied_label", "empty_friend_requests",
			"toast_friend_request_sent", "toast_friend_request_accepted",
			"toast_friend_request_denied", "toast_friend_request_cancelled",
			"toast_friend_request_failed", "friend_request_already_friends",
			"view_profile_action", "friend_requests_count_aria",
			"removing_friend",
			"online_label", "playing_label", "offline_label",
			"empty_live_games", "empty_history", "empty_friends", "empty_players",
			"loading_live", "loading_history", "loading_players",
			"sign_in_history", "sign_in_friends",
			"outcome_win", "outcome_loss", "outcome_draw", "moves_suffix",
			"meta_separator", "stats_separator", "wins_abbr", "losses_abbr",
			"mode_ai", "mode_pvp", "rating_paren_open", "rating_paren_close",
			"toast_enter_username", "toast_sign_in_challenge",
			"toast_challenge_sent_prefix", "toast_challenge_failed",
			"toast_invite_yourself",
			"toast_copy_failed", "toast_send_link_first",
			"toast_friend_added", "toast_friend_removed", "toast_friend_failed",
			"toast_time_control_unavailable", "toast_challenge_accept_failed",
			"toast_game_unavailable",
			"aria_color_white", "aria_color_black", "aria_color_random",
			"color_pref_note", "board_view_2d", "board_view_3d",
			"share_watch_action", "flip_board_aria", "share_game_aria",
			"create_game_title", "resume_game_action", "new_game_modes_aria",
			"label_players", "label_viewers", "label_game_id", "vs_separator",
			"viewers_overflow_prefix", "join_game_action", "download_qr_action",
			"download_qr_pending", "qr_preview_aria", "qr_lightbox_close_aria", "qr_unavailable",
			"toast_qr_download_failed", "live_game_popover_title",
			"games_played_abbr", "draws_abbr",
			"id_truncate_chars", "id_truncate_suffix", "viewers_empty_count",
			"search_debounce_ms", "live_player_name_max_chars", "name_truncate_suffix",
			"live_viewers_title", "back_to_live_games", "empty_live_viewers", "loading_live_viewers",
			"list_page_size", "loading_more",
			// web_app_origin is optional here - share/challenge links fail closed
			// when empty; Play rail chrome must still load so admin can set it.
			"play_rail_chrome_unavailable",
		},
	)
}

// MatchmakingChrome returns DB-backed matchmaking UI strings (fail closed).
func (a *PaymentsAPI) MatchmakingChrome(w http.ResponseWriter, r *http.Request) {
	writePlatformChromeJSON(w, a.Settings, "matchmaking chrome unavailable",
		func(s *store.SettingsStore) ([]byte, error) { return s.MatchmakingChromeJSON(r.Context()) },
		[]string{
			"source", "title", "blurb", "find_match_action", "leave_queue_action",
			"players_waiting_title", "queued_yes", "queued_no", "direct_invite_title",
			"direct_invite_blurb", "invite_placeholder", "send_invite_action",
			"accept_action", "decline_action", "invite_from_prefix", "matched_opening",
			"rating_label", "searching_suffix",
			"toast_match_found", "toast_matched_instantly", "toast_waiting_opponent",
			"toast_join_failed", "toast_invite_sent", "toast_invite_failed",
			"toast_invite_yourself",
			"toast_invite_received", "toast_invite_accepted", "toast_invite_declined",
			"toast_live_required", "matchmaking_chrome_unavailable", "meta_separator",
			"join_pending", "leave_pending", "send_invite_pending", "accept_pending",
			"decline_pending", "outgoing_invite_title", "outgoing_invite_blurb",
			"outgoing_keep_waiting_action", "outgoing_cancel_action",
			"outgoing_cancel_pending", "toast_invite_cancelled",
			"country_flag_image_url_template",
		},
	)
}

// AdminConsoleChrome returns nested DB chrome for remaining admin pages (fail closed).
func (a *PaymentsAPI) AdminConsoleChrome(w http.ResponseWriter, r *http.Request) {
	const errMsg = "admin console chrome unavailable"
	if a.Settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	raw, err := a.Settings.AdminConsoleChromeJSON(r.Context())
	if err != nil || len(raw) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	if strings.TrimSpace(asChromeString(doc["source"])) == "" ||
		strings.TrimSpace(asChromeString(doc["admin_console_chrome_unavailable"])) == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	sections := map[string][]string{
		"banks": {
			"page_title", "page_blurb", "provider_placeholder", "label_placeholder",
			"account_placeholder", "mobile_placeholder", "account_name_label", "add_action", "active_label",
			"inactive_label", "toast_added", "toast_updated", "toast_deleted", "toast_failed",
			"meta_separator",
			"add_pending", "status_pending", "select_all_label", "select_row_label",
			"selected_count_fmt", "clear_selection_action", "bulk_activate_action",
			"bulk_deactivate_action", "bulk_status_pending", "list_page_size",
			"edit_action", "delete_action", "delete_confirm", "save_action", "save_pending",
			"dialog_close_label", "cancel_action", "actions_label", "empty_label",
			"col_provider", "col_currency", "col_status", "col_label", "view_detail_action", "detail_title",
			"search_label", "search_placeholder", "filter_all_label",
			"empty_value", "provider_label", "label_label", "account_label", "mobile_label",
			"copy_action", "toast_copied", "toast_copy_failed",
			"copy_account_label", "copy_mobile_label", "copy_name_label",
		},
		"payments": {
			"page_title", "page_blurb",
			"overview_page_title", "overview_page_blurb",
			"overview_section_queues_title", "overview_section_volume_title", "overview_section_links_title",
			"overview_kpi_pending_receipts", "overview_kpi_pending_payouts", "overview_kpi_pending_kyc",
			"overview_kpi_topup_volume", "overview_kpi_payout_volume", "overview_kpi_host_fee_volume",
			"overview_kpi_entry_commission", "overview_kpi_wallet_balances", "overview_kpi_platform_revenue",
			"overview_kpi_net_profit",
			"overview_kpi_net_cashflow",
			"overview_empty_value", "overview_period_note",
			"overview_period_7d", "overview_period_30d", "overview_period_90d",
			"currency_section_title", "currency_load_failed",
			"global_label", "ethiopia_label", "supported_label", "save_currency_action",
			"save_currency_pending",
			"geo_payment_section_title", "geo_payment_load_failed",
			"geo_payment_ethiopia_country_label", "geo_payment_private_city_label",
			"geo_payment_private_region_label", "save_geo_payment_action", "save_geo_payment_pending",
			"toast_geo_payment_saved", "toast_geo_payment_failed",
			"receipts_section_title", "no_receipts", "user_prefix", "ref_prefix",
			"view_receipt_action", "approve_action", "reject_action",
			"receipt_approve_pending", "receipt_reject_pending",
			"toast_currency_saved", "toast_currency_failed", "toast_receipt_reviewed", "toast_receipt_failed",
			"toast_receipt_already_reviewed", "payout_transition_conflict",
			"amount_currency_separator", "list_join_separator",
			"payouts_section_title", "payouts_empty",
			"payout_approve_action", "payout_reject_action", "payout_mark_paid_action",
			"payout_approve_pending", "payout_reject_pending", "payout_mark_paid_pending",
			"doc_kyc_approve_pending", "doc_kyc_reject_pending",
			"payout_review_note_label", "payout_review_failed", "payout_reviewed",
			"payout_user_prefix", "payout_amount_prefix", "payout_status_prefix", "payout_phone_prefix",
			"payout_reviewed_at_prefix", "payout_note_prefix",
			"payout_history_pending", "payout_history_approved", "payout_history_rejected", "payout_history_paid",
			"list_page_size", "empty_value",
			"doc_kyc_section_title", "doc_kyc_empty", "doc_kyc_approve_action", "doc_kyc_reject_action",
			"doc_kyc_review_note_label", "doc_kyc_reviewed", "doc_kyc_review_failed",
			"doc_kyc_user_prefix", "doc_kyc_type_prefix", "doc_kyc_name_prefix", "doc_kyc_status_prefix",
			"doc_kyc_front_caption", "doc_kyc_back_caption", "doc_kyc_selfie_caption",
			"doc_kyc_filter_label", "doc_kyc_history_pending", "doc_kyc_history_approved",
			"doc_kyc_history_rejected", "doc_kyc_history_all",
			"transactions_section_title", "transactions_empty",
			"txn_col_user", "txn_col_kind", "txn_col_amount", "txn_col_status",
			"txn_col_reference", "txn_col_provider", "txn_col_when", "txn_col_actions",
			"txn_view_detail", "txn_detail_title", "txn_detail_close",
			"txn_status_awaiting_receipt", "txn_status_paid", "txn_status_pending",
			"txn_status_posted", "txn_status_approved", "txn_status_rejected",
			"txn_status_cancelled",
			"filter_all_label",
			"txn_kind_topup", "txn_kind_payout", "txn_kind_competition_prize_payout",
			"txn_kind_campaign_create_fee", "txn_kind_event_host_fee", "txn_kind_event_entry_paid",
			"txn_kind_event_entry_earned", "txn_kind_event_entry_commission",
			"txn_kind_event_entry_refund", "txn_kind_event_entry_clawback",
			"txn_kind_prize_pool_guarantee_hold", "txn_kind_prize_pool_guarantee_release",
			"txn_kind_prize_pool_guarantee_capture", "txn_kind_tournament_entry_refund",
			"receipt_col_user", "receipt_col_amount", "receipt_col_reference", "receipt_col_status",
			"receipt_col_when", "receipt_col_actions", "receipt_detail_title", "receipt_detail_close",
			"receipt_proof_label", "receipt_provider_label",
			"receipt_view_detail", "receipt_email_label", "receipt_reviewed_at_label",
			"receipt_intent_id_label", "receipt_pdf_label", "receipt_open_document_action",
			"search_label", "search_placeholder", "search_debounce_ms", "actions_label",
			"doc_kyc_col_user", "doc_kyc_col_type", "doc_kyc_col_name", "doc_kyc_col_status",
			"doc_kyc_col_when", "doc_kyc_col_actions", "doc_kyc_view_detail", "doc_kyc_detail_title", "doc_kyc_detail_close",
			"currency_page_title", "currency_page_blurb", "geo_page_title", "geo_page_blurb",
			"kyc_page_title", "kyc_page_blurb", "payouts_page_title", "payouts_page_blurb",
			"receipts_page_title", "receipts_page_blurb",
			"transactions_page_title", "transactions_page_blurb",
			"receipt_document_title", "receipt_brand_name",
			"receipt_section_bill_to", "receipt_section_from", "receipt_section_details",
			"receipt_section_payment", "receipt_section_transaction", "receipt_section_proof",
			"receipt_label_reference", "receipt_label_amount", "receipt_label_currency", "receipt_label_status",
			"receipt_label_channel", "receipt_label_date", "receipt_label_id", "receipt_label_paid_at",
			"receipt_label_billing_period",
			"receipt_header_meta_separator",
			"receipt_label_subtotal", "receipt_label_tax", "receipt_label_total", "receipt_label_amount_paid",
			"receipt_col_description", "receipt_col_product", "receipt_col_amount", "receipt_col_qty", "receipt_col_unit", "receipt_col_tax_rate",
			"receipt_section_tax_breakdown", "receipt_label_tax_percent", "receipt_label_tax_total",
			"receipt_tax_rate_display", "receipt_line_description",
			"receipt_merchant_via", "receipt_footer", "receipt_print_action", "receipt_print_pending",
			"receipt_download_action", "receipt_download_pending",
			"receipt_download_failed", "receipt_download_done", "receipt_download_filename_fmt",
			"receipt_brand_mark_alt", "receipt_proof_caption", "receipt_support_email",
			"receipt_status_pending", "receipt_status_approved", "receipt_status_rejected", "receipt_status_paid",
			"payout_col_user", "payout_col_amount", "payout_col_status", "payout_col_phone",
			"payout_col_when", "payout_col_provider", "payout_view_detail",
			"payout_detail_title", "payout_detail_close",
			"detail_id_label", "detail_user_id_label",
			"select_all_label", "select_row_label", "selected_count_fmt",
			"clear_selection_action",
			"telegram_ops_page_title", "telegram_ops_page_blurb", "telegram_ops_section_title",
			"telegram_ops_load_failed", "telegram_ops_enabled_label",
			"telegram_ops_bot_service_url_label", "telegram_ops_bot_api_key_label",
			"telegram_ops_bot_api_key_hint", "telegram_ops_reviewer_user_id_label",
			"telegram_ops_notify_timeout_ms_label", "telegram_ops_has_api_key_label",
			"save_telegram_ops_action", "save_telegram_ops_pending",
			"toast_telegram_ops_saved", "toast_telegram_ops_failed",
			"telegram_ops_ready_label", "telegram_ops_not_ready_label", "telegram_ops_status_joiner",
			"telegram_ops_settings_unavailable", "telegram_ops_config_unavailable",
			"telegram_ops_save_invalid",
			"host_trust_page_title", "host_trust_page_blurb",
			"host_trust_tab_gates", "host_trust_tab_caps", "host_trust_tab_reputation",
			"host_trust_col_setting", "host_trust_col_value", "host_trust_col_actions",
			"host_trust_view_action", "host_trust_edit_action",
			"host_trust_detail_title", "host_trust_edit_title",
			"host_trust_dialog_close", "host_trust_cancel_action",
			"host_trust_save_action", "host_trust_save_pending",
			"host_trust_toast_saved", "host_trust_toast_failed", "host_trust_save_invalid",
			"host_trust_load_failed", "host_trust_empty_value",
			"host_trust_search_label", "host_trust_search_placeholder",
			"host_trust_list_page_size", "host_trust_search_debounce_ms",
			"host_trust_yes", "host_trust_no",
			"host_trust_phone_kyc_label", "host_trust_phone_kyc_blurb",
			"host_trust_doc_kyc_label", "host_trust_doc_kyc_blurb",
			"host_trust_cap_new_host_label", "host_trust_cap_new_host_blurb",
			"host_trust_cap_phone_label", "host_trust_cap_phone_blurb",
			"host_trust_cap_document_label", "host_trust_cap_document_blurb",
			"host_trust_settled_threshold_label", "host_trust_settled_threshold_blurb",
			"host_trust_rep_open_reports_label", "host_trust_rep_open_reports_blurb",
			"host_trust_rep_cancel_bps_label", "host_trust_rep_cancel_bps_blurb",
			"host_trust_rep_cancel_sample_label", "host_trust_rep_cancel_sample_blurb",
		},
		"media_pool": {
			"page_title", "page_blurb", "register_title", "channel_id_label", "label_label",
			"client_id_label", "client_secret_label", "refresh_token_label", "api_key_label",
			"quota_label", "quota_placeholder", "add_channel_action", "quota_invalid",
			"channel_id_placeholder", "label_placeholder",
			"client_id_placeholder", "client_secret_placeholder",
			"refresh_token_placeholder", "api_key_placeholder",
			"test_upload_title", "upload_title_label", "upload_title_placeholder", "upload_title_required",
			"run_upload_action", "active_pool_title", "no_channels", "active_status",
			"inactive_status", "test_readiness_action", "remove_from_pool_action",
			"restore_to_pool_action", "toast_registered", "toast_status_updated",
			"toast_channel_ready", "toast_upload_complete", "toast_upload_failed",
			"uploads_today_suffix", "quota_separator", "quota_ratio_separator",
			"paren_open", "paren_close", "channel_meta_space",
			"row_actions_label", "select_all_label", "select_row_label", "selected_count_fmt",
			"clear_selection_action", "bulk_activate_action", "bulk_deactivate_action",
			"bulk_status_pending", "add_channel_pending", "run_upload_pending",
			"test_readiness_pending", "status_update_pending", "list_page_size", "empty_value",
			"view_detail_action", "dialog_close_label", "cancel_action",
			"search_label", "search_placeholder",
			"filter_all_label", "col_channel_id", "col_quota", "col_status", "detail_title",
			"last_error_label",
			"default_daily_quota", "quota_hint", "edit_channel_action", "delete_channel_action",
			"delete_channel_confirm", "save_channel_action", "sort_order_label", "sort_order_hint",
			"toast_channel_updated", "toast_channel_deleted", "toast_channel_update_failed",
			"toast_channel_delete_failed", "credentials_optional_blurb", "upload_file_label",
			"upload_file_hint", "err_channel_not_found", "err_channel_update_failed",
			"err_channel_delete_failed", "err_quota_invalid", "err_sort_order_invalid",
			"err_upload_file_required", "err_upload_file_type", "err_upload_file_too_large",
			"err_invalid_json", "err_register_failed", "err_upload_failed",
			"err_upload_queue_failed", "err_read_failed", "default_upload_title",
			"upload_drop_title", "upload_drop_hint", "upload_browse_action",
			"upload_replace_action", "upload_remove_action", "upload_uploading_label",
			"upload_selected_label", "upload_local_path_label", "upload_local_path_placeholder",
			"upload_local_path_blurb", "upload_section_file_title", "upload_section_path_title",
		},
		"feature_flags": {
			"page_title", "page_blurb", "load_failed", "depths_invalid", "flags_not_loaded",
			"current_prefix", "unavailable", "toast_updated", "ai_depths_title", "ai_depths_blurb",
			"save_depths_action", "save_depths_pending", "toggle_on", "toggle_pending", "toggle_off",
			"list_join_separator",
			"cash_disabled_countries_title", "cash_disabled_countries_blurb",
			"cash_disabled_countries_label", "cash_disabled_countries_save",
			"cash_disabled_countries_save_pending", "cash_disabled_countries_saved",
			"cash_disabled_countries_failed",
			"cash_allowed_countries_title", "cash_allowed_countries_blurb",
			"cash_allowed_countries_label", "cash_allowed_countries_add_label",
			"cash_allowed_countries_add_action", "cash_allowed_countries_add_pending",
			"cash_allowed_countries_remove_action", "cash_allowed_countries_remove_pending",
			"cash_allowed_countries_save", "cash_allowed_countries_save_pending",
			"cash_allowed_countries_saved", "cash_allowed_countries_failed",
			"cash_allowed_countries_empty",
		},
		"avatars": {
			"page_title", "page_blurb", "rules_title", "config_unavailable", "provider_prefix",
			"enabled_suffix", "disabled_suffix", "auto_review_action", "manual_review_action",
			"no_pending", "approve_action", "flag_action", "reset_action",
			"toast_moderation_saved", "toast_avatar_updated",
			"row_actions_label", "select_all_label", "select_row_label", "selected_count_fmt",
			"clear_selection_action", "bulk_approve_action", "bulk_approve_pending",
			"approve_pending", "flag_pending", "reset_pending", "moderation_settings_pending",
			"list_page_size",
			"view_detail_action", "dialog_close_label", "cancel_action", "detail_title",
			"col_user", "col_rating", "search_label", "search_placeholder",
			"empty_value", "detail_id_label", "thumbnail_label",
		},
		"telemetry": {
			"page_title", "page_title_short", "page_blurb", "fingerprints_title",
			"no_fingerprints", "geo_title", "no_geo", "audit_title", "no_audit",
			"meta_separator", "region_city_separator", "actor_action_separator",
			"list_page_size",
			"map_title", "map_empty_title", "map_empty_body",
			"map_listings_count_fmt", "map_footer_hint",
			"select_all_label", "select_row_label", "selected_count_fmt",
			"clear_selection_action", "search_label", "search_placeholder",
			"view_detail_action", "dialog_close_label", "cancel_action",
			"row_actions_label",
			"col_user", "col_fingerprint", "col_platform", "col_ip", "col_seen",
			"col_country", "col_region", "col_city", "col_source", "col_coords",
			"col_when", "col_action", "col_entity", "col_actor", "col_user_agent",
			"fp_detail_title", "geo_detail_title", "audit_detail_title",
			"detail_id_label", "detail_user_id_label", "empty_value",
		},
		"users": {
			"page_title", "page_blurb", "rating_prefix", "xp_prefix", "active_label",
			"disabled_label", "deactivate_action", "activate_action", "toast_role_updated",
			"toast_user_activated", "toast_user_deactivated",
			"wins_abbr", "losses_abbr", "stats_separator", "meta_separator",
			"col_user_label", "col_record_label", "col_status_label", "col_role_label",
			"row_actions_label",
			"select_all_label", "select_row_label", "selected_count_fmt",
			"clear_selection_action", "bulk_activate_action", "bulk_deactivate_action",
			"bulk_status_pending",
			"confirm_deactivate_title", "confirm_deactivate_description", "confirm_cancel",
			"confirm_deactivate", "confirm_deactivate_pending",
			"confirm_activate_title", "confirm_activate_description",
			"confirm_activate", "confirm_activate_pending",
			"date_range_label", "date_range_placeholder", "date_range_clear",
			"date_range_apply", "date_range_months", "date_range_locale",
			"country_flag_image_url_template", "list_page_size",
			"filter_all_label", "col_country_label", "detail_id_label",
			"view_detail_action", "dialog_close_label", "cancel_action", "detail_title",
			"col_email_label", "col_phone_label", "col_xp_label", "col_rating_label", "col_draws_label",
			"col_created_label", "search_label", "search_placeholder", "empty_value",
			"detail_phone_label", "detail_avatar_alt", "detail_age_kyc_label", "detail_phone_kyc_label",
			"detail_document_kyc_label",
			"detail_region_label", "detail_payout_section", "detail_payout_empty",
			"detail_payout_provider_label", "detail_payout_account_label", "detail_payout_phone_label",
			"detail_back_action", "detail_verified_yes", "detail_verified_no",
			"detail_load_failed", "open_detail_pending", "open_full_detail_action", "edit_role_action",
			"read_permission_key", "write_role_permission_key", "write_active_permission_key", "lacks_read",
			"confirm_role_title", "confirm_role_description", "confirm_role", "confirm_role_pending",
			"bulk_confirm_activate_title", "bulk_confirm_activate_description",
			"bulk_confirm_deactivate_title", "bulk_confirm_deactivate_description",
			"detail_dob_label",
			"copy_action", "copied_action", "copy_id_label", "copy_email_label", "copy_phone_label",
			"contact_section_label",
			"host_rep_finished_label", "host_rep_cancelled_label", "host_rep_reports_label", "host_rep_meta_separator",
		},
		"dashboard": {
			"page_title", "page_blurb", "nav_unavailable",
			"kpi_modules_label", "empty_value",
			"section_live_title", "section_ops_title", "section_platform_title",
			"kpi_open_reports_label", "kpi_hosted_cups_label", "kpi_tournaments_label",
		},
		"activity": {
			"page_title", "page_blurb", "load_failed", "period_label",
			"period_day_label", "period_week_label", "period_month_label", "period_year_label",
			"kpi_online_now", "kpi_playing_now", "kpi_users_total", "kpi_new_users",
			"kpi_visited", "kpi_played", "kpi_games_finished",
			"kpi_dau", "kpi_wau", "kpi_mau",
			"series_title", "series_subtitle", "series_y_axis", "series_today_label",
			"series_visited_label", "series_played_label",
			"series_games_label", "series_new_users_label", "series_empty",
			"series_visited_color", "series_played_color", "series_games_color",
			"series_new_users_color", "series_legend_aria",
			"live_section_title", "period_section_title", "engagement_section_title",
			"heatmap_title", "heatmap_empty", "heatmap_total_label",
			"heatmap_stat_longest_streak", "heatmap_stat_current_streak",
			"heatmap_stat_peak_day", "heatmap_stat_peak_month", "heatmap_streak_unit",
			"cumulative_title", "cumulative_empty", "cumulative_series_label",
			"breakdown_modes_title", "breakdown_modes_empty",
			"breakdown_outcomes_title", "breakdown_outcomes_empty", "breakdown_outcomes_meta_fmt",
			"outcome_decisive_label", "outcome_draw_label",
			"breakdown_entry_title", "breakdown_entry_empty",
			"entry_free_label", "entry_paid_label",
		},
		"progression": {
			"page_title", "page_blurb", "load_failed", "toast_progression_saved",
			"toast_board_saved", "board_fields_required",
			"xp_levels_label",
			"match_rewards_section_title", "match_rewards_blurb",
			"win_xp_label", "draw_xp_label", "loss_xp_label",
			"win_rating_label", "draw_rating_label", "loss_rating_label",
			"starting_rating_label", "rating_floor_label",
			"err_match_rewards_xp", "err_match_rewards_rating", "err_starting_rating", "err_rating_floor",
			"match_clock_enabled_label", "initial_seconds_label",
			"match_clock_presets_label",
			"increment_seconds_label", "invite_ttl_seconds_label", "unit_cost_label",
			"pause_enabled_label", "pause_duration_label", "pause_duration_blurb", "err_pause_duration",
			"pause_duration_placeholder", "pause_duration_unit_aria",
			"pause_duration_seconds_label", "pause_duration_minutes_label",
			"web_app_origin_label", "err_web_app_origin",
			"campaign_create_fees_section_title",
			"campaign_create_fee_ethiopia_label", "campaign_create_fee_ethiopia_currency_label",
			"campaign_create_fee_global_label", "campaign_create_fee_global_currency_label",
			"campaign_create_fee_geo_blurb", "err_campaign_create_fee",
			"save_platform_action", "save_platform_pending",
			"board_section_title", "board_unavailable", "board_size_label",
			"pieces_per_side_label", "setup_rows_label", "variant_label",
			"save_board_action", "save_board_pending", "err_unit_cost", "err_clock_values",
			"err_clock_initial_not_in_presets",
			"toast_save_failed", "err_xp_levels_json", "err_xp_levels_empty",
			"xp_col_label", "xp_col_min_xp", "xp_actions_label", "xp_add_action",
			"xp_view_action", "xp_edit_action", "xp_delete_action", "xp_empty",
			"xp_dialog_close_label", "xp_cancel_action", "xp_save_action", "xp_save_pending",
			"xp_create_modal_title", "xp_edit_modal_title", "xp_detail_modal_title",
			"xp_delete_confirm", "xp_label_field", "xp_min_xp_field",
			"select_all_label", "select_row_label", "selected_count_fmt", "clear_selection_action",
			"xp_search_label", "xp_search_placeholder", "empty_value",
		},
	}
	for section, keys := range sections {
		rawSec, ok := doc[section]
		if !ok {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
		sec, ok := rawSec.(map[string]any)
		if !ok {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
		for _, key := range keys {
			if !chromeValuePresent(key, asChromeString(sec[key])) {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
				return
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func asChromeString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case json.Number:
		return t.String()
	case float64:
		// encoding/json defaults numbers to float64 - chrome values must still pass fail-closed checks.
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case bool:
		if t {
			return "true"
		}
		return "false"
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(t))
	}
}

// chromeValuePresent accepts non-empty strings. Separator/joiner/space keys may be
// whitespace-only because those characters are intentional layout tokens from the DB.
func chromeValuePresent(key, v string) bool {
	if v == "" {
		return false
	}
	if strings.HasSuffix(key, "_separator") ||
		strings.HasSuffix(key, "_joiner") ||
		strings.HasSuffix(key, "_space") {
		return true
	}
	return strings.TrimSpace(v) != ""
}

func writePlatformChromeJSON(
	w http.ResponseWriter,
	settings *store.SettingsStore,
	errMsg string,
	load func(*store.SettingsStore) ([]byte, error),
	required []string,
) {
	if settings == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	raw, err := load(settings)
	if err != nil || len(raw) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
		return
	}
	for _, key := range required {
		if !chromeValuePresent(key, asChromeString(doc[key])) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": errMsg})
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}
