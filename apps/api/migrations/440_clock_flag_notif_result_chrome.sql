-- In-app game_finished body args for flag-fall / clock-draw (DB-driven; no Go invent).

UPDATE platform_settings
SET value = value || '{
  "notif_result_win_on_time": "won on time",
  "notif_result_loss_on_time": "lost on time",
  "notif_result_draw_on_time": "draw on time"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';
