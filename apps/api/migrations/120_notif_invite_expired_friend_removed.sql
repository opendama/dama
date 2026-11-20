-- Invite TTL expiry + friend remove (player audience).
INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.invite_expired', 'player', 'Challenge expired', 'Your challenge to %s expired before it was accepted.', '/?view=match', ''),
  ('player.friend_removed', 'player', 'Friend removed', '%s removed you as a friend.', '/?view=match', '')
ON CONFLICT (code) DO NOTHING;
