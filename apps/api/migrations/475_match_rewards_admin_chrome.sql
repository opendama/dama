-- Admin Progression CRUD chrome for PvP career match_rewards (XP + rating deltas).
-- Values remain platform_settings.match_rewards; VS-AI never applies them.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || '{
    "match_rewards_section_title": "Rated match rewards",
    "match_rewards_blurb": "How much career XP and rating change when a rated human vs human match ends. Queue games are always rated. Invites can be rated or unrated. VS-AI practice never uses these. Rating may be negative for losses. Profile rating never drops below 100.",
    "win_xp_label": "Win XP",
    "draw_xp_label": "Draw XP",
    "loss_xp_label": "Loss XP",
    "win_rating_label": "Win rating",
    "draw_rating_label": "Draw rating",
    "loss_rating_label": "Loss rating",
    "err_match_rewards_xp": "Match reward XP values must be whole numbers of 0 or more",
    "err_match_rewards_rating": "Match reward rating values must be whole numbers (losses may be negative)"
  }'::jsonb,
  true
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
