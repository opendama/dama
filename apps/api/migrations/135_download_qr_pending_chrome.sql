-- Trim-parity pending label for live-game QR download CTA.

UPDATE platform_settings
SET value = value || '{
  "download_qr_pending": "Downloading…"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
