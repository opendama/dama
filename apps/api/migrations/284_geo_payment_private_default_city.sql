-- Private-IP / localhost invent city+region from DB (reference Addis Ababa parity; no Go hardcode).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'private_default_city', 'Addis Ababa',
  'private_default_region', ''
),
updated_at = NOW()
WHERE key = 'geo_payment'
  AND (
    COALESCE(value->>'private_default_city', '') = ''
    OR NOT (value ? 'private_default_city')
  );
