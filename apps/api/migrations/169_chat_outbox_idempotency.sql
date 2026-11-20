-- Telegram-grade chat outbox: server idempotency (client_id) + DB chrome for
-- pending / failed / retry (no client-invented glyphs or copy).

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE game_chat_messages
  ADD COLUMN IF NOT EXISTS client_id TEXT;

-- One outbound message per (thread|game, author, client_id). Retries return the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_messages_thread_user_client
  ON dm_messages (thread_id, user_id, client_id)
  WHERE client_id IS NOT NULL AND length(btrim(client_id)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_chat_messages_game_user_client
  ON game_chat_messages (game_id, user_id, client_id)
  WHERE client_id IS NOT NULL AND length(btrim(client_id)) > 0;

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_pending_aria": "Sending",
  "chat_receipt_pending_glyph": "◷",
  "chat_receipt_failed_aria": "Not sent. Tap to retry",
  "chat_receipt_failed_glyph": "!",
  "chat_receipt_retry_action": "Retry"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_pending_aria": "Sending",
  "chat_receipt_pending_glyph": "◷",
  "chat_receipt_failed_aria": "Not sent. Tap to retry",
  "chat_receipt_failed_glyph": "!",
  "chat_receipt_retry_action": "Retry"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
