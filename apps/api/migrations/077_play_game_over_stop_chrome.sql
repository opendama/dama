-- Play surface: game-over + stop confirm chrome (smart-menu Guest play parity).
UPDATE platform_settings
SET value = value || '{
  "game_over_title": "Match result",
  "you_won_message": "You won",
  "you_lost_message": "You lost",
  "restart_action": "Play again",
  "stop_game_action": "Stop game",
  "stop_game_confirm_title": "Stop this match?",
  "stop_game_confirm_description": "The board will close and return to practice setup. This cannot be undone for the current session.",
  "stop_game_confirm_cancel": "Keep playing",
  "stop_game_confirm_confirm": "Stop game",
  "stop_game_pending": "Stopping…",
  "stop_game_success": "Match stopped",
  "captures_your_label": "Your captures",
  "captures_opponent_label": "Opponent captures",
  "practice_start_pending": "Starting…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
