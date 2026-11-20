-- Stop-game failure copy: abandon must not reuse toast_load_failed ("Failed to load match").
UPDATE platform_settings
SET value = value || '{
  "stop_game_failed": "Could not stop the match. Try again."
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
