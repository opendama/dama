-- Play rail infinite-scroll page size + loading-more label (NotificationBell parity).

UPDATE platform_settings
SET value = value || '{
  "list_page_size": "20",
  "loading_more": "Loading more…"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
