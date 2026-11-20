-- Esports match intro + result overlay chrome (AI / friends / PvP / tournament).

UPDATE platform_settings
SET value = value || '{
  "match_intro_vs_label": "vs",
  "match_intro_starting_label": "Game starting",
  "match_intro_duration_ms": "3200",
  "match_intro_aria": "Match starting",
  "match_result_duration_ms": "4200",
  "match_result_win_aria": "You won",
  "match_result_loss_aria": "You lost",
  "match_result_draw_aria": "Draw"
}'::jsonb,
    updated_at = NOW()
WHERE key IN ('play_rail_chrome', 'play_chrome', 'spectate_chrome');
