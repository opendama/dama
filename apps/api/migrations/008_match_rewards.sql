-- Non-monetary PvP career rewards (XP / rating deltas). VS-AI never applies these.
INSERT INTO platform_settings (key, value) VALUES
(
  'match_rewards',
  '{
    "win_xp": 25,
    "draw_xp": 10,
    "loss_xp": 5,
    "win_rating": 16,
    "draw_rating": 0,
    "loss_rating": -16,
    "rating_floor": 100,
    "starting_rating": 1200
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
