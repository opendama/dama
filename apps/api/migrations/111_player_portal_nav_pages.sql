-- Player portal: Overview chrome + dedicated Receipts / Transactions / Settings cards.

UPDATE platform_settings
SET value = value || '{
  "dashboard_page_title": "Overview",
  "dashboard_page_blurb": "Your rating, wallet balance, career stats, and recent matches."
}'::jsonb,
updated_at = NOW()
WHERE key = 'client_nav';

-- Append missing portal cards (idempotent).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'receipts'
  ) THEN '[]'::jsonb ELSE '[{"title":"Receipts","href":"/receipts","route_key":"receipts","body":"Submit payment receipts for manual top-ups.","cta":"Open receipts"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'transactions'
  ) THEN '[]'::jsonb ELSE '[{"title":"Transactions","href":"/transactions","route_key":"transactions","body":"Top-ups, payouts, and wallet movement.","cta":"Open transactions"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'dashboard', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'settings'
  ) THEN '[]'::jsonb ELSE '[{"title":"Settings","href":"/settings","route_key":"settings","body":"Account privacy, export, and compliance controls.","cta":"Open settings"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

-- Rename Dashboard → Overview in player nav when present.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'route_key' = 'dashboard'
          THEN elem || '{"title":"Overview","href":"/dashboard"}'::jsonb
        WHEN elem->>'route_key' = 'receipts'
          THEN elem || '{"href":"/receipts"}'::jsonb
        WHEN elem->>'route_key' = 'transactions'
          THEN elem || '{"href":"/transactions"}'::jsonb
        WHEN elem->>'route_key' = 'settings'
          THEN elem || '{"href":"/settings"}'::jsonb
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND value ? 'player';
