-- DM: peer read watermark (Telegram-style ✓ / ✓✓).
CREATE TABLE IF NOT EXISTS dm_thread_reads (
  thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES dm_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_thread_reads_thread
  ON dm_thread_reads (thread_id);

-- Game / multi-participant chat: per-message unique viewers (Telegram channel-style counts).
CREATE TABLE IF NOT EXISTS game_chat_reads (
  message_id UUID NOT NULL REFERENCES game_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_chat_reads_message
  ON game_chat_reads (message_id);

CREATE TABLE IF NOT EXISTS game_chat_user_reads (
  game_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES game_chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);
