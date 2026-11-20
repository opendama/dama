-- Match real 3D board piece colors: player 1 ivory/white, player 2 red (not black).
-- Keys stay label_black / status_black_* for API stability; display strings say Red.

UPDATE platform_settings
SET value = value || '{
  "label_white": "white",
  "label_black": "red",
  "status_white_to_move": "White to move",
  "status_black_to_move": "Red to move",
  "status_your_turn": "Your turn (white)",
  "status_opponent_turn": "Opponent turn (red)",
  "status_p1_wins": "White wins",
  "status_p2_wins": "Red wins"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "label_white": "White",
  "label_black": "Red",
  "status_your_turn": "White to move",
  "status_opponent_turn": "Red to move",
  "status_white_to_move": "White to move",
  "status_black_to_move": "Red to move",
  "status_p1_wins": "White wins",
  "status_p2_wins": "Red wins"
}'::jsonb,
updated_at = NOW()
WHERE key = 'spectate_chrome';
