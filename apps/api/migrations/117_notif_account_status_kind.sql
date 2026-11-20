-- Additive kind for admin activate/deactivate (Trim user.account_status parity).
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.account_status', 'player', 'Account status', 'Your account status is now %s.', '/settings', '')
ON CONFLICT (code) DO NOTHING;
