-- QR download filename prefix from DB (no server invent of "dama-game-").

UPDATE platform_settings
SET value = value || '{
  "qr_download_filename_prefix": "dama-game-"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
