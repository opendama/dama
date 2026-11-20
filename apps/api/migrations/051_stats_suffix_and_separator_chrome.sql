-- Stats separators, draw/enroll suffixes, telemetry/media separators, client_enums unavailable.

UPDATE platform_settings
SET value = value || '{
  "stats_separator": "/"
}'::jsonb,
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';

UPDATE platform_settings
SET value = value || '{
  "status_draw_reason_open": " (",
  "status_draw_reason_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "status_draw_reason_open": " (",
  "status_draw_reason_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'spectate_chrome';

UPDATE platform_settings
SET value = value || '{
  "enrolled_charged_close": ")"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournaments_player_chrome';

UPDATE platform_settings
SET value = value || '{
  "unavailable": "client enums unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || '{
    "region_city_separator": " / "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || '{
    "quota_ratio_separator": "/"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
