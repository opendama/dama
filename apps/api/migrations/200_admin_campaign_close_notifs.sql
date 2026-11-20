-- Admin notifications for manual campaign close/reopen (parity with events + auto_close).
-- Idempotent.

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('admin.campaign_closed', 'admin', 'Campaign closed', 'Publisher closed campaign "%s".', '/ads', ''),
  ('admin.campaign_reopened', 'admin', 'Campaign reopened', 'Publisher reopened campaign "%s".', '/ads', '')
ON CONFLICT (code) DO NOTHING;

-- Player join conflict: event_full on player chrome (fail-closed join path).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "event_full": "This event is full"
}'::jsonb,
updated_at = NOW()
WHERE key = 'events_player_chrome'
  AND COALESCE(value->>'event_full', '') = '';
