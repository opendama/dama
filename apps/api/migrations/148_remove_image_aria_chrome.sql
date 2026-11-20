-- Remove-image control labels (compose / chat / DM) - DB chrome only.

UPDATE platform_settings
SET value = value || '{
  "remove_image_aria": "Remove image"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
