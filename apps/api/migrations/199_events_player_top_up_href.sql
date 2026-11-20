-- Player join top-up must use DB href (no hardcoded /wallet).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "top_up_href": "/wallet"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome';
