-- Stop/abandon copy + bottom-nav resume labels (Trim Continue / Playing…).

UPDATE platform_settings
SET value = value || '{
  "stop_game_confirm_description": "You will resign this match. The opponent wins and the board returns to the result screen.",
  "nav_continue_label": "Continue",
  "nav_playing_label": "Playing…",
  "history_skip_first": "First",
  "history_skip_prev": "Prev",
  "history_skip_next": "Next",
  "history_skip_last": "Last",
  "history_skip_go": "Go",
  "history_skip_page_of": "Page {page} of {pages}"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
