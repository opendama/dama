-- Hall of Fame: DB-driven default period + list page size (no client invent).

UPDATE platform_settings
SET value = value || '{
  "default_period": "week",
  "list_page_size": "20"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'leaderboard_chrome';
