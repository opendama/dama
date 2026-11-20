-- Marketing/brand/site meta on client_nav; console meta; residual play/avatar/ads/admin chrome.

UPDATE platform_settings
SET value = value || '{
  "ads_brand_name": "dama Ads",
  "marketing_hero_eyebrow": "FMJD 10x10",
  "marketing_hero_blurb": "Compete in International Draughts tournaments, play live matches, practice against the computer, and publish ads around the board.",
  "marketing_footer_text": "dama International Draughts",
  "site_title_default": "dama",
  "site_title_template": "%s | dama",
  "site_description": "International Draughts tournament platform. Play, compete, and publish around the 10x10 board.",
  "graphql_empty": "Empty GraphQL response"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = value || '{
  "title_template": "%s | dama Console",
  "meta_description": "dama control console. Feature flags, payments, media pool, RBAC.",
  "meta_separator": " · ",
  "graphql_empty": "Empty GraphQL response"
}'::jsonb,
updated_at = NOW()
WHERE key = 'console_nav';

UPDATE platform_settings
SET value = value || '{
  "status_started": "started",
  "toast_ws_connection_error": "connection error"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';

UPDATE platform_settings
SET value = value || '{
  "crop_canvas_unavailable": "canvas unavailable",
  "crop_failed": "crop failed"
}'::jsonb,
updated_at = NOW()
WHERE key = 'avatar_chrome';

UPDATE platform_settings
SET value = value || '{
  "publisher_invoice_filename": "dama-ad-invoice.pdf",
  "playback_unavailable": "ad playback unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "err_xp_levels_json": "xp_levels must be valid JSON",
    "err_xp_levels_empty": "xp_levels requires at least one level"
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || '{
    "meta_separator": " · "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || '{
    "meta_separator": " · "
  }'::jsonb
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || '{
  "meta_separator": " · "
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';
