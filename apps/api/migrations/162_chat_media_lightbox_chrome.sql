-- Chat media lightbox title + close aria (no client English invent).

UPDATE platform_settings
SET value = value || '{
  "chat_media_lightbox_title": "Media",
  "chat_media_lightbox_close_aria": "Close"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_media_lightbox_title": "Media",
  "chat_media_lightbox_close_aria": "Close"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
