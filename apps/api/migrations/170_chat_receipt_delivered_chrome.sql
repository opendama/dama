-- Delivered receipt chrome keys (retained fail-closed).
-- 1:1 DM ticks are pending → sent → read (single ✓ until peer watermark; ✓✓ brand on read).
-- AttachDMReceipts does not emit "delivered" without device-delivery acks; clients map
-- any legacy delivered to the same single-tick as sent. Glyphs/aria from DB only.

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_delivered_aria": "Delivered",
  "chat_receipt_delivered_glyph": "✓✓"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_receipt_delivered_aria": "Delivered",
  "chat_receipt_delivered_glyph": "✓✓"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
