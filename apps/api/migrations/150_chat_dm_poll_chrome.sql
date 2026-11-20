-- Chat/DM client poll intervals (DB chrome only; no invented ms on clients).

UPDATE platform_settings
SET value = value || '{
  "chat_poll_interval_ms": "12000",
  "dm_poll_interval_ms": "8000",
  "dm_requests_poll_interval_ms": "15000"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
