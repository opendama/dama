-- Career XP level ladder + match clock config (admin-editable, no client hardcodes).
INSERT INTO platform_settings (key, value) VALUES
  (
    'xp_levels',
    '{
      "levels": [
        {"min_xp": 0, "label": "Novice"},
        {"min_xp": 100, "label": "Apprentice"},
        {"min_xp": 500, "label": "Competitor"},
        {"min_xp": 1500, "label": "Expert"},
        {"min_xp": 4000, "label": "Master"},
        {"min_xp": 10000, "label": "Grandmaster"}
      ]
    }'::jsonb
  ),
  (
    'match_clock',
    '{
      "enabled": true,
      "initial_seconds": 600,
      "increment_seconds": 0
    }'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
