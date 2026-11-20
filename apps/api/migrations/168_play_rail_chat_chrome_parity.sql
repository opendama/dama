-- Re-assert chat/DM chrome keys required by Play rail + spectate fail-closed clients.
-- Idempotent jsonb merge (safe to re-run on Docker + Supabase).

UPDATE platform_settings
SET value = value || '{
  "chat_date_today": "Today",
  "chat_date_yesterday": "Yesterday",
  "dm_request_cancelled_label": "Cancelled",
  "dm_unread_badge_max": "99",
  "dm_unread_badge_overflow_fmt": "{max}+",
  "dms_unread_count_aria": "{count} unread messages",
  "dm_load_failed_label": "Could not load messages",
  "chat_load_failed_label": "Could not load chat"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_date_today": "Today",
  "chat_date_yesterday": "Yesterday",
  "chat_load_failed_label": "Could not load chat"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
