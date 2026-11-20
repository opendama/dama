-- Tournament list/enroll/console API errors from DB (no invent English).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_enrollable_status_unavailable": "Enrollable tournament status unavailable",
  "err_load_failed": "Unable to load tournaments",
  "err_tournament_not_found": "Tournament not found",
  "err_not_open_for_enrollment": "Tournament not open for enrollment"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_load_failed": "Unable to load tournaments",
  "err_status_required": "Status required",
  "err_invalid_status": "Invalid status",
  "err_status_update_failed": "Unable to update tournament status",
  "err_media_unavailable": "Media upload unavailable",
  "err_invalid_multipart": "Invalid multipart form",
  "err_file_required": "File required",
  "err_read_failed": "Read failed",
  "err_upload_failed": "Unable to upload media",
  "err_tournament_not_found": "Tournament not found"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';
