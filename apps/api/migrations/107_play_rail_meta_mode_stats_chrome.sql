-- Play rail: DB-backed meta/stats separators + mode/W-L abbrs (no client invent).
INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'play_rail_chrome',
  '{
    "meta_separator": " · ",
    "stats_separator": " · ",
    "wins_abbr": "W",
    "losses_abbr": "L",
    "mode_ai": "AI",
    "mode_pvp": "PvP"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
