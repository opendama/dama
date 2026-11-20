-- Hall of Fame: default period All Time (was week). Tab order remains client enum order all→week→month→year.

UPDATE platform_settings
SET value = value || '{
  "default_period": "all"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'leaderboard_chrome';
