-- Tournament admin media chrome (prize thumbnail + gallery labels; fail closed).

UPDATE platform_settings
SET value = value || '{
  "thumbnail_label": "Prize image",
  "gallery_label": "Gallery",
  "gallery_add_action": "Add gallery image",
  "gallery_empty": "No gallery images yet",
  "thumbnail_upload_action": "Upload prize image",
  "toast_thumbnail_saved": "Prize image saved",
  "toast_gallery_saved": "Gallery updated",
  "media_upload_failed": "Media upload failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';
