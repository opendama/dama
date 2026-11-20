-- Direct messages: request → accept flow (friend-request parity) + private thread chat.

CREATE TABLE IF NOT EXISTS dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_threads_distinct CHECK (user_low <> user_high),
  CONSTRAINT dm_threads_pair_unique UNIQUE (user_low, user_high)
);

CREATE TABLE IF NOT EXISTS dm_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES dm_threads(id) ON DELETE SET NULL,
  body TEXT,
  image_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'denied', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_requests_distinct CHECK (from_user_id <> to_user_id),
  CONSTRAINT dm_requests_payload CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR (image_url IS NOT NULL AND length(trim(image_url)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_dm_requests_to_pending
  ON dm_requests (to_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_requests_from_status
  ON dm_requests (from_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  image_url TEXT,
  reply_to_id UUID REFERENCES dm_messages(id) ON DELETE SET NULL,
  request_id UUID REFERENCES dm_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_messages_payload CHECK (
    (body IS NOT NULL AND length(trim(body)) > 0)
    OR (image_url IS NOT NULL AND length(trim(image_url)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_created
  ON dm_messages (thread_id, created_at ASC);

UPDATE platform_settings
SET value = value || '{
  "sub_dms": "DMs",
  "dms_requests_count_aria": "{count} DM requests",
  "message_action": "Message",
  "dm_modal_title": "Message",
  "dm_send_action": "Send",
  "dm_sending": "Sending...",
  "dm_input_placeholder": "Type a message...",
  "dm_empty_requests": "No DM requests",
  "dm_request_pending_label": "Pending",
  "dm_request_outgoing_label": "Sent",
  "dm_request_denied_label": "Denied",
  "dm_accept_action": "Accept",
  "dm_accepting": "Accepting...",
  "dm_deny_action": "Deny",
  "dm_denying": "Denying...",
  "dm_cancel_action": "Cancel",
  "dm_cancelling": "Cancelling...",
  "dm_preview_max_chars": "20",
  "dm_preview_truncate_suffix": "...",
  "dm_toast_sent": "Message sent",
  "dm_toast_accepted": "DM accepted",
  "dm_toast_denied": "DM denied",
  "dm_toast_cancelled": "DM cancelled",
  "dm_toast_failed": "Could not update DM",
  "dm_chat_empty": "No messages yet",
  "dm_reply_action": "Reply",
  "dm_reply_cancel": "Cancel reply",
  "dm_attach_image_aria": "Attach image",
  "dm_emoji_aria": "Insert emoji",
  "dm_words_label": "Words"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

INSERT INTO notification_kinds (code, audience, title_template, body_template, href_path, href_query_key)
VALUES
  ('player.dm_request', 'player', 'New message', '%s sent you a message.', '/?rail=players&sub=dms', 'dm'),
  ('player.dm_request_accepted', 'player', 'DM accepted', '%s accepted your message.', '/?rail=players&sub=dms', 'dm'),
  ('player.dm_request_denied', 'player', 'DM denied', '%s denied your message.', '/?rail=players&sub=dms', ''),
  ('player.dm_request_cancelled', 'player', 'DM cancelled', '%s cancelled their message.', '/?rail=players&sub=dms', ''),
  ('player.dm_message', 'player', 'New DM', '%s sent a message.', '/?rail=players&sub=dms', 'thread')
ON CONFLICT (code) DO UPDATE
SET href_path = EXCLUDED.href_path,
    href_query_key = EXCLUDED.href_query_key,
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;
