-- Play rail: search debounce + live player name truncate (no client invent).

UPDATE platform_settings
SET value = value || '{
  "search_debounce_ms": "250",
  "live_player_name_max_chars": "12",
  "name_truncate_suffix": "..."
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
