-- Telegram-style message reactions for game chat + DMs.
CREATE TABLE IF NOT EXISTS game_chat_reactions (
  message_id UUID NOT NULL REFERENCES game_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT game_chat_reactions_emoji_len CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 16)
);

CREATE INDEX IF NOT EXISTS idx_game_chat_reactions_message
  ON game_chat_reactions (message_id);

CREATE TABLE IF NOT EXISTS dm_message_reactions (
  message_id UUID NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT dm_message_reactions_emoji_len CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 16)
);

CREATE INDEX IF NOT EXISTS idx_dm_message_reactions_message
  ON dm_message_reactions (message_id);
