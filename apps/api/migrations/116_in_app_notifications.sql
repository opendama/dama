-- Trim-parity in-app notifications (player + admin). Copy lives on kinds + notification_chrome.

CREATE TABLE IF NOT EXISTS notification_kinds (
  code TEXT PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('player', 'admin')),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  href_path TEXT NOT NULL DEFAULT '',
  href_query_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('player', 'admin')),
  kind_code TEXT NOT NULL REFERENCES notification_kinds(code),
  body_args JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedupe_key TEXT,
  href_entity_id TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_recipient_dedupe_uidx
  ON app_notifications (recipient_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

CREATE INDEX IF NOT EXISTS app_notifications_recipient_created_idx
  ON app_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_unread_idx
  ON app_notifications (recipient_id)
  WHERE read_at IS NULL;

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key) VALUES
  ('player.invite_received', 'player', 'Challenge received', '%s challenged you to a match.', '/?view=match', ''),
  ('player.invite_accepted', 'player', 'Challenge accepted', '%s accepted your challenge.', '/', 'gameId'),
  ('player.invite_declined', 'player', 'Challenge declined', '%s declined your challenge.', '/?view=match', ''),
  ('player.invite_cancelled', 'player', 'Challenge cancelled', 'A pending challenge was cancelled.', '/?view=match', ''),
  ('player.match_found', 'player', 'Match found', 'Your match is ready. Open the board to play.', '/', 'gameId'),
  ('player.wallet_credited', 'player', 'Wallet updated', 'Your wallet was credited %s %s.', '/wallet', ''),
  ('player.receipt_reviewed', 'player', 'Receipt reviewed', 'Your payment receipt was %s.', '/receipts', 'id'),
  ('player.payout_updated', 'player', 'Payout update', 'Your payout request is now %s.', '/wallet', ''),
  ('player.kyc_reviewed', 'player', 'Identity review', 'Your identity verification was %s.', '/settings', ''),
  ('player.friend_added', 'player', 'New friend', '%s added you as a friend.', '/?view=match', ''),
  ('player.tournament_status', 'player', 'Tournament update', 'Tournament "%s" is now %s.', '/?view=tournaments', ''),
  ('player.campaign_status', 'player', 'Campaign update', 'Campaign "%s" is now %s.', '/ads/campaigns', ''),
  ('player.game_finished', 'player', 'Match finished', 'Your match against %s ended (%s).', '/', 'gameId'),
  ('player.avatar_reviewed', 'player', 'Avatar review', 'Your avatar was %s.', '/settings', ''),
  ('player.account_status', 'player', 'Account status', 'Your account status is now %s.', '/settings', ''),
  ('admin.receipt_pending', 'admin', 'Receipt pending', 'New manual receipt from %s (%s %s).', '/payments', 'receipt'),
  ('admin.payout_pending', 'admin', 'Payout pending', 'New payout request from %s (%s %s).', '/payments', 'payout'),
  ('admin.kyc_pending', 'admin', 'KYC pending', '%s submitted identity documents.', '/payments', 'kyc'),
  ('admin.avatar_pending', 'admin', 'Avatar pending', '%s uploaded an avatar for review.', '/avatars', 'user')
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_settings (key, value) VALUES (
  'notification_chrome',
  '{
    "bell_aria": "Notifications",
    "bell_aria_count_fmt": "{aria}, {count}",
    "panel_title": "Notifications",
    "empty_message": "No notifications yet.",
    "mark_all_read": "Mark all read",
    "mark_all_pending": "Marking…",
    "mark_read": "Mark read",
    "mark_read_pending": "Updating…",
    "unread_label": "Unread",
    "loading_more": "Loading more…",
    "poll_interval_ms": "60000",
    "list_page_size": "20",
    "badge_max": "99",
    "badge_overflow_fmt": "{max}+",
    "list_failed": "Could not load notifications.",
    "mark_failed": "Could not update notification.",
    "count_failed": "Could not load unread count.",
    "unavailable": "Notifications unavailable",
    "mark_read_done": "Marked as read.",
    "mark_all_read_done": "All notifications marked as read."
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
