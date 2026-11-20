-- Spectate watch rail: focus + Back chrome (no client invent).
-- Overview keeps vote/share; Moves/Chat/Info enter focus with compact vote strip.

UPDATE platform_settings
SET value = value || '{
  "watch_panel_back_action": "Back",
  "watch_panel_back_aria": "Leave panel focus and show vote",
  "vote_score_separator": "-"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "watch_panel_back_action": "Back",
  "watch_panel_back_aria": "Leave panel focus and show vote",
  "vote_score_separator": "-"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
