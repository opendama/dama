-- Home = Play (bottom nav Home → /); Dashboard = ops chrome + prune play/matchmaking panels.

-- 1) Bottom nav: Home opens marketing Play hub, not dashboard.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{bottom_nav,player}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' IN ('home', 'dashboard')
          AND (elem->>'href' = '/dashboard' OR elem->>'href' IS NULL OR elem->>'href' = '')
        THEN elem || '{"href":"/","route_key":"home","title":"Home"}'::jsonb
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'bottom_nav'->'player', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'bottom_nav';

-- 2) Dashboard panels: drop play + matchmaking (Play lives on Home).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) AS elem
    WHERE elem->>'route_key' NOT IN ('play', 'matchmaking')
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'dashboard';

-- 3) Ops-focused dashboard chrome + history labels (fail closed keys).
UPDATE platform_settings
SET value = value || '{
  "dashboard_page_blurb": "Wallet, ads, profile, and your recent matches.",
  "dashboard_history_title": "Recent matches",
  "dashboard_history_empty": "No match history yet",
  "dashboard_history_unavailable": "Match history unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';
