-- Telegram-style chat date separators (Today / Yesterday). Message clock uses locale HH:mm on clients.

UPDATE platform_settings
SET value = value || '{
  "chat_date_today": "Today",
  "chat_date_yesterday": "Yesterday"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';

UPDATE platform_settings
SET value = value || '{
  "chat_date_today": "Today",
  "chat_date_yesterday": "Yesterday"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'spectate_chrome';
