-- Chat/DM error chrome (join-gated empty vs load fail; DM deep-link open fail).

UPDATE platform_settings
SET value = value || '{
  "chat_join_required_label": "Join the game to view chat",
  "chat_load_failed_label": "Could not load chat",
  "dm_open_failed": "Could not open this message"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_join_required_label": "Join the game to view chat",
  "chat_load_failed_label": "Could not load chat"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
