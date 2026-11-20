-- Flag-fall result copy: keep clock_flag as a real win; clients show Won/Lost/Drew on time.
-- Also seeds aria labels for cinematic result overlays (play_chrome + play_rail_chrome).

UPDATE platform_settings
SET value = value || '{
  "you_won_on_time_message": "Won on time",
  "you_lost_on_time_message": "Lost on time",
  "you_drew_on_time_message": "Draw on time",
  "match_result_win_on_time_aria": "Won on time",
  "match_result_loss_on_time_aria": "Lost on time",
  "match_result_draw_on_time_aria": "Draw on time"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "match_result_win_on_time_aria": "Won on time",
  "match_result_loss_on_time_aria": "Lost on time",
  "match_result_draw_on_time_aria": "Draw on time"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
