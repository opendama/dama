-- Ensure player nav includes full portal ops links (Overview already renamed in 111).
-- Idempotent append of receipts / transactions / settings.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'receipts'
  ) THEN '[]'::jsonb ELSE '[{"title":"Receipts","href":"/receipts","route_key":"receipts"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'transactions'
  ) THEN '[]'::jsonb ELSE '[{"title":"Transactions","href":"/transactions","route_key":"transactions"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{player}',
  COALESCE(value->'player', '[]'::jsonb) ||
  CASE WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(value->'player', '[]'::jsonb)) e
    WHERE e->>'route_key' = 'settings'
  ) THEN '[]'::jsonb ELSE '[{"title":"Settings","href":"/settings","route_key":"settings"}]'::jsonb END
),
updated_at = NOW()
WHERE key = 'client_nav';
