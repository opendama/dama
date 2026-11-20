-- Admin upload pending labels + spectate Live/history chrome (Trim / smart-menu parity).

UPDATE platform_settings
SET value = value || '{
  "thumbnail_upload_pending": "Uploading…",
  "gallery_upload_pending": "Uploading…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "thumbnail_upload_pending": "Uploading…",
  "gallery_upload_pending": "Uploading…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome'
  AND NOT (value ? 'thumbnail_upload_pending');

UPDATE platform_settings
SET value = value || '{
  "live_label": "Live",
  "history_label": "Moves",
  "status_replay": "Replay",
  "seat_meta_separator": " vs ",
  "status_your_turn": "White to move",
  "status_opponent_turn": "Black to move",
  "label_white": "White",
  "label_black": "Black"
}'::jsonb,
updated_at = NOW()
WHERE key = 'spectate_chrome';
