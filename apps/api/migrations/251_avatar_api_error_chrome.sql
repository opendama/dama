-- Avatar upload API errors from DB (no invent English on /me/avatar).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "err_unauthorized": "Sign in required",
  "err_moderation_unavailable": "Avatar moderation config unavailable",
  "err_invalid_multipart": "Invalid multipart form",
  "err_file_required": "File required",
  "err_read_failed": "Read failed",
  "err_process_failed": "Unable to process avatar",
  "err_media_upload_unavailable": "Media upload unavailable",
  "err_invalid_image": "Invalid image file",
  "err_save_failed": "Unable to save avatar",
  "err_serve_forbidden": "Forbidden"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'avatar_chrome';
