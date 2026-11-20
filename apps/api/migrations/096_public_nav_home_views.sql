-- Public left/bottom nav: discovery on `/` via view=. Ops (dashboard/wallet/profile) leave the public rail.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  '[
    {"title":"Play","href":"/","route_key":"play"},
    {"title":"Matchmaking","href":"/?view=match","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/?view=tournaments","route_key":"tournaments"},
    {"title":"Leaderboard","href":"/?view=leaderboard","route_key":"leaderboard"},
    {"title":"Spectate","href":"/?view=spectate","route_key":"spectate"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  '[
    {"title":"Play","href":"/","route_key":"play"},
    {"title":"Matchmaking","href":"/?view=match","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/?view=tournaments","route_key":"tournaments"},
    {"title":"Leaderboard","href":"/?view=leaderboard","route_key":"leaderboard"},
    {"title":"Spectate","href":"/?view=spectate","route_key":"spectate"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';

-- Dashboard cards stay ops-only (wallet / profile / ads).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
    WHERE elem->>'route_key' IN ('wallet', 'profile', 'ads', 'ads_dashboard', 'history', 'matches')
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'dashboard';
