-- Chess.com-style nav: Home = Play hub; drop Play tab; dashboard ops without tournaments;
-- marketing hero blurb = product promise (board first).

-- 1) bottom_nav.player: Home → / (route_key home); remove play/matchmaking tabs.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT
        CASE
          WHEN elem->>'route_key' IN ('home', 'dashboard')
            THEN (elem - 'href') || '{"href":"/","route_key":"home","title":"Home"}'::jsonb
          ELSE elem
        END AS elem,
        ord
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb))
        WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'route_key' NOT IN ('play', 'matchmaking')
    ) pruned
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

-- 2) bottom_nav.mobile: same Home + prune play/matchmaking.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,mobile}',
  (
    SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    FROM (
      SELECT
        CASE
          WHEN elem->>'route_key' IN ('home', 'dashboard')
            THEN (elem - 'href') || '{"route_key":"home","title":"Home"}'::jsonb
          ELSE elem
        END AS elem,
        ord
      FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'mobile', '[]'::jsonb))
        WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'route_key' NOT IN ('play', 'matchmaking')
    ) pruned
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

-- 3) Dashboard panels: ops only (drop play/matchmaking/tournaments browse).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
    WHERE elem->>'route_key' NOT IN ('play', 'matchmaking', 'tournaments', 'leaderboard', 'spectate')
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'dashboard';

-- 4) Marketing hero: one-line product promise (Play first).
UPDATE platform_settings
SET value = value || '{
  "marketing_hero_eyebrow": "FMJD 10x10 / International Draughts",
  "marketing_hero_blurb": "Land on a live draughts board. Try AI free. Match when ready. Sign in for wallet, history, and ads."
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
