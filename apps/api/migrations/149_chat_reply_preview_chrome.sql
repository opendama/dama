-- Reply-quote truncation + chat loading chrome (no client hardcoding).
-- reply preview max/suffix/image label drive game-chat + DM reply_preview server-side.

UPDATE platform_settings
SET value = value || '{
  "chat_reply_preview_max_chars": "80",
  "chat_loading": "Loading…",
  "dm_chat_loading": "Loading…"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
