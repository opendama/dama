-- Play rail: remove-friend action label (fail-closed; no client invent).

UPDATE platform_settings
SET value = value || '{
  "remove_friend_action": "Remove Friend"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_rail_chrome';
