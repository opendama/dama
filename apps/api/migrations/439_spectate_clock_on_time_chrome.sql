-- Spectate Watch rail: flag-fall / clock-draw status copy (DB-driven; no client invent).

UPDATE platform_settings
SET value = value || '{
  "status_p1_wins_on_time": "White won on time",
  "status_p2_wins_on_time": "Black won on time",
  "status_draw_on_time": "Draw on time"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
