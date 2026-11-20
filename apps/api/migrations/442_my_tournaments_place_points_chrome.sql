-- My tournaments memory: place / points labels (profile + discovery mine).
-- Viewer stats come from tournament_entries; labels are DB chrome only.

UPDATE platform_settings
SET value = value || '{
  "my_tournaments_place_label": "Place",
  "my_tournaments_points_label": "Points",
  "my_tournaments_streak_label": "Streak"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournaments_player_chrome';
