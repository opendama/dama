-- Telegram-style unread badges on DM list rows + DMs tab.
UPDATE platform_settings
SET value = value || '{
  "dm_unread_badge_max": "99",
  "dm_unread_badge_overflow_fmt": "{max}+",
  "dms_unread_count_aria": "{count} unread messages"
}'::jsonb
WHERE key = 'play_rail_chrome';
