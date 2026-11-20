-- Friend requests: pending / accepted / denied (industry request-accept flow).
-- Accepted pairs also land in player_friends (existing friends list).

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_requests_distinct CHECK (from_user_id <> to_user_id),
  CONSTRAINT friend_requests_pair_unique UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_pending
  ON friend_requests (to_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status
  ON friend_requests (from_user_id, status, created_at DESC);

UPDATE platform_settings
SET value = value || '{
  "sub_friend_requests": "Requests",
  "send_friend_request_action": "Add Friend",
  "sending_friend_request": "Sending...",
  "accept_friend_request_action": "Accept",
  "accepting_friend_request": "Accepting...",
  "deny_friend_request_action": "Deny",
  "denying_friend_request": "Denying...",
  "cancel_friend_request_action": "Cancel Request",
  "cancelling_friend_request": "Cancelling...",
  "friend_request_pending_label": "Pending",
  "friend_request_outgoing_label": "Sent",
  "friend_request_denied_label": "Denied",
  "empty_friend_requests": "No friend requests",
  "toast_friend_request_sent": "Friend request sent",
  "toast_friend_request_accepted": "Friend request accepted",
  "toast_friend_request_denied": "Friend request denied",
  "toast_friend_request_cancelled": "Friend request cancelled",
  "toast_friend_request_failed": "Could not update friend request",
  "friend_request_already_friends": "Already friends"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  ('player.friend_request', 'player', 'Friend request', '%s sent you a friend request.', '/?view=match', ''),
  ('player.friend_request_accepted', 'player', 'Friend request accepted', '%s accepted your friend request.', '/?view=match', ''),
  ('player.friend_request_denied', 'player', 'Friend request denied', '%s denied your friend request.', '/?view=match', '')
ON CONFLICT (code) DO NOTHING;
