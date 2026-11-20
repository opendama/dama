-- Dedicated player profile: game-history column labels + friends section + joined label.

UPDATE platform_settings
SET value = value || '{
  "game_history_players_col": "Players",
  "game_history_result_col": "Result",
  "game_history_moves_col": "Moves",
  "game_history_date_col": "Date",
  "friends_section_title": "Friends",
  "joined_label": "Joined"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'profile_inspect_chrome';
