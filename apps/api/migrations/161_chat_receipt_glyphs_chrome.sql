-- DB-backed receipt / seen glyphs (no client hardcoding of ✓ / ✓✓ / 👁).

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_sent_glyph": "✓",
  "chat_receipt_read_glyph": "✓✓",
  "chat_seen_count_glyph": "👁"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_sent_glyph": "✓",
  "chat_receipt_read_glyph": "✓✓",
  "chat_seen_count_glyph": "👁"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
