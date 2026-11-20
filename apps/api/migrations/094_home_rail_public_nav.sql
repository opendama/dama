-- Home left rail: public Play routes + ops stay on Dashboard cards only.
-- Merge leaderboard / spectate / tournaments / matchmaking into bottom_nav.player + player.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  '[
    {"title":"Home","href":"/","route_key":"home"},
    {"title":"Play","href":"/play","route_key":"play"},
    {"title":"Matchmaking","href":"/matchmaking","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/tournaments","route_key":"tournaments"},
    {"title":"Leaderboard","href":"/leaderboard","route_key":"leaderboard"},
    {"title":"Spectate","href":"/spectate","route_key":"spectate"},
    {"title":"Dashboard","href":"/dashboard","route_key":"dashboard"},
    {"title":"Wallet","href":"/wallet","route_key":"wallet"},
    {"title":"Profile","href":"/profile","route_key":"profile"}
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
    {"title":"Home","href":"/","route_key":"home"},
    {"title":"Play","href":"/play","route_key":"play"},
    {"title":"Matchmaking","href":"/matchmaking","route_key":"matchmaking"},
    {"title":"Tournaments","href":"/tournaments","route_key":"tournaments"},
    {"title":"Leaderboard","href":"/leaderboard","route_key":"leaderboard"},
    {"title":"Spectate","href":"/spectate","route_key":"spectate"},
    {"title":"Dashboard","href":"/dashboard","route_key":"dashboard"},
    {"title":"Wallet","href":"/wallet","route_key":"wallet"},
    {"title":"Profile","href":"/profile","route_key":"profile"},
    {"title":"Ads","href":"/ads/dashboard","route_key":"ads"}
  ]'::jsonb
),
updated_at = NOW()
WHERE key = 'client_nav';

-- Dashboard cards: ops only (wallet / profile / ads / history lives on page).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
    WHERE elem->>'route_key' IN ('wallet', 'profile', 'ads')
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'dashboard';
