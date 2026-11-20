-- History open needs the live Redis game id (match_history.id is a separate UUID).
-- Plus fail-closed chrome for TC / challenge accept / game open / color a11y.

ALTER TABLE match_history
  ADD COLUMN IF NOT EXISTS game_id UUID;

CREATE INDEX IF NOT EXISTS idx_match_history_game_id ON match_history (game_id);

UPDATE platform_settings
SET
  value = value || '{
    "toast_time_control_unavailable": "Time controls unavailable",
    "toast_challenge_accept_failed": "Could not accept challenge link",
    "toast_game_unavailable": "This game is no longer available",
    "aria_color_white": "White",
    "aria_color_black": "Black",
    "aria_color_random": "Random"
  }'::jsonb,
  updated_at = NOW()
WHERE key = 'play_rail_chrome';
