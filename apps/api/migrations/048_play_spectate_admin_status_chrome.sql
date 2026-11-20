-- Live board status templates, spectate live moves, admin users/media/tournament display chrome.

UPDATE platform_settings
SET value = value || '{
  "status_matched": "matched",
  "status_ws_prefix": "ws:",
  "status_synced_moves_prefix": "synced moves=",
  "toast_ai_depth_required": "AI depth required from server"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "status_live_moves_prefix": "live moves="
}'::jsonb,
updated_at = NOW()
WHERE key = 'spectate_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || '{
    "wins_abbr": "W",
    "losses_abbr": "L",
    "stats_separator": "/",
    "meta_separator": " · "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "uploads_today_suffix": "today",
    "quota_separator": " · "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || '{
  "is_free_true": "true",
  "is_free_false": "false"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';
