-- Colored country-flag image URL template (Chess.com-style). Clients substitute ISO-2 `{code}`.
-- Never invent a URL in clients when chrome is missing.

INSERT INTO platform_settings (key, value)
VALUES (
  'country_flag_chrome',
  '{
    "source": "database",
    "country_flag_chrome_unavailable": "Country flags unavailable",
    "image_url_template": "https://flagcdn.com/w20/{code}.png"
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = platform_settings.value || EXCLUDED.value,
    updated_at = NOW();

-- Surfaces that already load these chromes can read the same template without an extra round-trip.
UPDATE platform_settings
SET value = value || '{"country_flag_image_url_template":"https://flagcdn.com/w20/{code}.png"}'::jsonb,
    updated_at = NOW()
WHERE key IN ('play_rail_chrome', 'profile_inspect_chrome', 'leaderboard_chrome', 'matchmaking_chrome', 'spectate_chrome');

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || '{"country_flag_image_url_template":"https://flagcdn.com/w20/{code}.png"}'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
