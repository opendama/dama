-- Play rail share origin (DB-driven; Flutter challenge/share links).
-- Leaderboard playing label for Online/Playing/Offline presence.

UPDATE platform_settings
SET value = value || '{
  "web_app_origin": "http://localhost:3000"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "playing_label": "Playing"
}'::jsonb,
updated_at = NOW()
WHERE key = 'leaderboard_chrome';
