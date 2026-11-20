-- Split thumb bottom tabs from hamburger / desktop rail.
-- Bottom: primary play loop (4). Player rail: full discovery + signed-in ops for hamburger.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  '[
    {"title":"Play","href":"/","route_key":"play"},
    {"title":"Matchmaking","href":"/?view=match","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/?view=tournaments","route_key":"tournaments"},
    {"title":"Spectate","href":"/?view=spectate","route_key":"spectate"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

-- Desktop rail + hamburger: discovery (incl. Leaderboard) + ops for signed-in More menu.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  '[
    {"title":"Play","href":"/","route_key":"play"},
    {"title":"Matchmaking","href":"/?view=match","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/?view=tournaments","route_key":"tournaments"},
    {"title":"Leaderboard","href":"/?view=leaderboard","route_key":"leaderboard"},
    {"title":"Spectate","href":"/?view=spectate","route_key":"spectate"},
    {"title":"Dashboard","href":"/dashboard","route_key":"dashboard"},
    {"title":"Wallet","href":"/wallet","route_key":"wallet"},
    {"title":"Profile","href":"/profile","route_key":"profile"},
    {"title":"Ads","href":"/ads/dashboard","route_key":"ads"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';
