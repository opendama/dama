-- Trim Button pending labels + smart-menu outgoing invite wait chrome.

UPDATE platform_settings
SET value = value || '{
  "join_pending": "Joining…",
  "leave_pending": "Leaving…",
  "send_invite_pending": "Sending…",
  "accept_pending": "Accepting…",
  "decline_pending": "Declining…",
  "outgoing_invite_title": "Invite sent",
  "outgoing_invite_blurb": "Waiting for your opponent to accept.",
  "outgoing_keep_waiting_action": "Keep waiting",
  "outgoing_cancel_action": "Cancel invite",
  "outgoing_cancel_pending": "Cancelling…",
  "toast_invite_cancelled": "Invite cancelled"
}'::jsonb,
updated_at = NOW()
WHERE key = 'matchmaking_chrome';

UPDATE platform_settings
SET value = value || '{
  "confirm_pending": "Enrolling…",
  "checkout_pending": "Opening checkout…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'payment_modal_chrome';

UPDATE platform_settings
SET value = value || '{
  "create_pending": "Creating…",
  "replace_creative_pending": "Replacing…",
  "attach_video_pending": "Attaching…",
  "thumbnail_upload_pending": "Uploading…",
  "gallery_upload_pending": "Uploading…"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
