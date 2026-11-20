-- Live viewers roster (Games tab drill-in by game id) + play_rail chrome.

UPDATE platform_settings
SET value = value || '{
  "live_viewers_title": "Live viewers",
  "back_to_live_games": "Back to games",
  "empty_live_viewers": "No viewers yet",
  "loading_live_viewers": "Loading viewers..."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
