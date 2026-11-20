-- Live games list labels + QR join chrome (fail-closed; merge into play_rail_chrome).

UPDATE platform_settings
SET value = value || '{
  "label_players": "Players",
  "label_viewers": "Viewers",
  "label_game_id": "Game ID",
  "vs_separator": "vs",
  "viewers_overflow_prefix": "+",
  "join_game_action": "Join the game",
  "download_qr_action": "Download QR code",
  "qr_preview_aria": "Preview QR code",
  "qr_lightbox_close_aria": "Close QR preview",
  "qr_unavailable": "QR code unavailable",
  "toast_qr_download_failed": "Could not download QR code",
  "live_game_popover_title": "Live match",
  "games_played_abbr": "GP",
  "draws_abbr": "D"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
