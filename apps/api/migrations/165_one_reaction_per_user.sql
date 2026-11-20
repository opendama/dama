-- One reaction per user per message (Telegram-style). Deduplicate then unique (message_id, user_id).

-- Keep the newest row per (message_id, user_id) on both tables.
DELETE FROM dm_message_reactions a
USING dm_message_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

DELETE FROM dm_message_reactions a
USING dm_message_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.ctid < b.ctid
  AND a.created_at = b.created_at;

DELETE FROM game_chat_reactions a
USING game_chat_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

DELETE FROM game_chat_reactions a
USING game_chat_reactions b
WHERE a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.ctid < b.ctid
  AND a.created_at = b.created_at;

ALTER TABLE dm_message_reactions DROP CONSTRAINT IF EXISTS dm_message_reactions_pkey;
ALTER TABLE dm_message_reactions
  ADD CONSTRAINT dm_message_reactions_pkey PRIMARY KEY (message_id, user_id);

ALTER TABLE game_chat_reactions DROP CONSTRAINT IF EXISTS game_chat_reactions_pkey;
ALTER TABLE game_chat_reactions
  ADD CONSTRAINT game_chat_reactions_pkey PRIMARY KEY (message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_dm_message_reactions_created
  ON dm_message_reactions (created_at);

CREATE INDEX IF NOT EXISTS idx_game_chat_reactions_created
  ON game_chat_reactions (created_at);
