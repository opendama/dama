-- Time-control presets for challenge picker (DB-only; no client invent).
-- Plus Create Game / resume chrome strings for the Play rail.

UPDATE platform_settings
SET
  value = value || '{
    "presets": [
      {"seconds": 60, "label": "1 min"},
      {"seconds": 180, "label": "3 min"},
      {"seconds": 600, "label": "10 min"},
      {"seconds": 1800, "label": "30 min"}
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE key = 'match_clock';

INSERT INTO platform_settings (key, value, updated_at)
VALUES (
  'play_rail_chrome',
  '{
    "create_game_title": "Create Game",
    "resume_game_action": "Open",
    "new_game_modes_aria": "New game modes",
    "play_rail_chrome_unavailable": "Play rail chrome unavailable"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = platform_settings.value || EXCLUDED.value,
  updated_at = NOW();
