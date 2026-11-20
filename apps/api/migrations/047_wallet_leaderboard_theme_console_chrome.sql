-- Wallet payment-route labels, leaderboard W/L/D chrome, theme chrome, console brand (fail closed).

UPDATE platform_settings
SET value = value || '{
  "payment_route_prefix": "Route",
  "payment_route_separator": " · ",
  "payout_required_marker": "*"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "wins_abbr": "W",
  "losses_abbr": "L",
  "draws_abbr": "D",
  "stats_separator": " / ",
  "meta_separator": " · ",
  "rank_prefix": "#",
  "xp_suffix": "XP"
}'::jsonb,
updated_at = NOW()
WHERE key = 'leaderboard_chrome';

UPDATE platform_settings
SET value = value || '{
  "brand_title": "dama Console"
}'::jsonb,
updated_at = NOW()
WHERE key = 'console_nav';

INSERT INTO platform_settings (key, value)
VALUES (
  'theme_chrome',
  '{
    "source": "database",
    "theme_chrome_unavailable": "Theme chrome unavailable",
    "aria_label": "Theme",
    "label_system": "System",
    "label_light": "Light",
    "label_dark": "Dark",
    "label_system_resolved_prefix": "System",
    "aria_template": "Theme: {current}. Click for {next}.",
    "title_template": "Theme: {current}"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
