-- Hosted events API errors: DB chrome only (no English invent in handlers).
-- Keys used by writeEventsOrgErr / writeEventsPlayerErr / writeEventsAdminErr.

-- Hosting organizer API errors: Tournament wording (not Event sport). migrateonly
-- re-applies this file before 380 soft-fills - keep seeds Tournament-safe so
-- mid-migrate never flashes "Unable to create event" via writeEventsOrgErr.
-- Admin ops chrome below may keep Event.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_catalog_unavailable": "Tournament catalog unavailable",
  "err_unauthorized": "Sign in required",
  "err_title_required": "Title is required",
  "err_format_size_required": "Format and size are required",
  "err_invalid_format_id": "Invalid format",
  "err_format_not_allowed_for_size": "This format is not allowed for the selected size",
  "err_invalid_visibility": "Invalid visibility",
  "err_entry_fee_invalid": "Entry fee amount is invalid",
  "err_entry_fee_required": "Entry fee amount is required",
  "err_event_not_found": "Tournament not found",
  "err_event_not_editable": "This tournament cannot be edited",
  "err_invalid_json": "Invalid request body",
  "err_no_fields": "No fields to update",
  "err_invalid_multipart": "Invalid upload form",
  "err_file_required": "A file is required",
  "err_read_failed": "Could not read the file",
  "err_entry_not_found": "Player entry not found",
  "err_auto_approve_only": "Join is always auto-approved",
  "err_refund_failed": "Unable to refund entry fee",
  "err_cannot_close": "This tournament cannot be closed",
  "err_cannot_start": "This tournament cannot be started",
  "err_format_not_startable": "This format cannot be started",
  "err_bracket_exists": "Bracket already exists",
  "err_event_not_live": "Tournament is not live",
  "err_match_not_found": "Match not found",
  "err_match_not_ready": "Match is not ready",
  "err_players_missing": "Players are missing for this match",
  "err_games_unavailable": "Games service unavailable",
  "err_board_rules_unavailable": "Board rules unavailable",
  "err_board_init_failed": "Unable to initialize board",
  "err_share_url_unavailable": "Share link unavailable",
  "err_create_failed": "Unable to create tournament",
  "err_dashboard_failed": "Unable to load dashboard",
  "err_analytics_failed": "Unable to load analytics",
  "err_update_failed": "Unable to update tournament",
  "err_list_failed": "Unable to load tournaments",
  "err_media_unavailable": "Media upload unavailable",
  "err_media_upload_failed": "Unable to upload media",
  "err_logo_save_failed": "Unable to save logo",
  "err_sponsor_save_failed": "Unable to save sponsor logo",
  "err_entries_failed": "Unable to load entries",
  "err_close_failed": "Unable to close tournament",
  "err_start_failed": "Unable to start tournament",
  "err_bracket_failed": "Unable to load bracket",
  "err_start_game_failed": "Unable to start game",
  "err_attach_game_failed": "Unable to attach game",
  "err_qr_failed": "Unable to generate QR"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- Player API errors: Tournament wording (not Event sport). migrateonly re-applies
-- this file before later soft-fills - keep seeds Tournament-safe so mid-migrate
-- never flashes "Event not found" via writeEventsPlayerErr. Admin ops chrome may keep Event.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_code_required": "Join code is required",
  "err_event_not_found": "Tournament not found",
  "err_entry_fee_unavailable": "Entry fee is unavailable",
  "err_unauthorized": "Sign in required",
  "err_forbidden": "You cannot view this tournament",
  "err_invalid_json": "Invalid request body",
  "err_invalid_reason_code": "Invalid report reason",
  "err_report_already_open": "You already have an open report",
  "err_report_submit_failed": "Unable to submit report",
  "err_share_url_unavailable": "Share link unavailable",
  "public_disabled": "Community tournaments are temporarily unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_report_not_found": "Report not found",
  "err_event_not_found": "Event not found",
  "err_list_failed": "Unable to load events",
  "err_reports_failed": "Unable to load reports",
  "err_dismiss_failed": "Unable to dismiss report",
  "err_deactivate_failed": "Unable to deactivate event",
  "err_report_update_failed": "Unable to update report",
  "err_refund_failed": "Unable to refund entry fees",
  "err_unauthorized": "Sign in required",
  "err_catalog_unavailable": "Events catalog unavailable",
  "err_catalog_invalid": "Events catalog is invalid",
  "err_invalid_json": "Invalid request body",
  "feature_disabled": "Events are temporarily unavailable",
  "events_admin_chrome_unavailable": "Events admin chrome unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_admin_chrome';
