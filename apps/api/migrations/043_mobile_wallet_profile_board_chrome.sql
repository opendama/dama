-- Mobile wallet page chrome + profile page title + live board chrome (fail closed).

UPDATE platform_settings
SET value = value || '{
  "page_title": "Wallet",
  "balance_label": "Balance",
  "balance_pending": "Load route to see balance",
  "country_code_label": "Country code (backend geo)",
  "country_code_hint": "Resolved from location",
  "top_up_amount_label": "Top-up amount",
  "top_up_action": "Top up",
  "refresh_action": "Refresh route & wallet",
  "detect_location_action": "Detect location"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "page_title": "Profile",
  "zoom_hint": "Pinch to zoom the verified profile image",
  "wld_label": "W/L/D",
  "moves_suffix": "moves",
  "player_unavailable": "Player unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';

UPDATE platform_settings
SET value = value || '{
  "live_board_title": "Live board",
  "match_clock_prefix": "Match clock",
  "status_prefix": "Status",
  "status_starting": "starting…",
  "increment_suffix": "s",
  "seat_meta_separator": " · "
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
