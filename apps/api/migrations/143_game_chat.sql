-- Per-game spectator/player chat: text + image + reply; players toggle enable.

CREATE TABLE IF NOT EXISTS game_chat_settings (
  game_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  image_url TEXT,
  reply_to_id UUID REFERENCES game_chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_chat_messages_payload CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR (image_url IS NOT NULL AND length(trim(image_url)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_game_chat_messages_game_created
  ON game_chat_messages (game_id, created_at ASC);

UPDATE platform_settings
SET value = value || '{
  "watch_tab_moves": "Moves",
  "watch_tab_chat": "Chat",
  "watch_tab_info": "Info",
  "observing_game_label": "Observing game",
  "chat_disabled_label": "Chat Disabled",
  "chat_enabled_label": "Chat Enabled",
  "chat_disable_action": "Disable chat",
  "chat_enable_action": "Enable chat",
  "chat_disable_pending": "Disabling...",
  "chat_enable_pending": "Enabling...",
  "chat_input_placeholder": "Type a message...",
  "chat_send_action": "Send",
  "chat_sending": "Sending...",
  "chat_reply_action": "Reply",
  "chat_reply_cancel": "Cancel reply",
  "chat_attach_image_aria": "Attach image",
  "chat_empty": "No messages yet",
  "chat_image_only_hint": "Images only",
  "chat_toast_disabled": "Chat is disabled",
  "chat_toast_send_failed": "Could not send message",
  "chat_toast_toggle_failed": "Could not update chat",
  "chat_emoji_aria": "Insert emoji"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "watch_tab_moves": "Moves",
  "watch_tab_chat": "Chat",
  "watch_tab_info": "Info",
  "observing_game_label": "Observing game",
  "chat_disabled_label": "Chat Disabled",
  "chat_enabled_label": "Chat Enabled",
  "chat_disable_action": "Disable chat",
  "chat_enable_action": "Enable chat",
  "chat_disable_pending": "Disabling...",
  "chat_enable_pending": "Enabling...",
  "chat_input_placeholder": "Type a message...",
  "chat_send_action": "Send",
  "chat_sending": "Sending...",
  "chat_reply_action": "Reply",
  "chat_reply_cancel": "Cancel reply",
  "chat_attach_image_aria": "Attach image",
  "chat_empty": "No messages yet",
  "chat_image_only_hint": "Images only",
  "chat_toast_disabled": "Chat is disabled",
  "chat_toast_send_failed": "Could not send message",
  "chat_toast_toggle_failed": "Could not update chat",
  "chat_emoji_aria": "Insert emoji"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
