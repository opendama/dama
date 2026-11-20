-- Receipt letterhead brand mark alt: title-case product name "Dama".
-- Display-only; idempotent. Does not touch payment geo, bots, or game logic.

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'receipt_brand_mark_alt', CASE
    WHEN lower(trim(COALESCE(value->>'receipt_brand_mark_alt', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'receipt_brand_mark_alt'), '')
  END
)),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'receipt_brand_mark_alt', COALESCE(NULLIF(trim(value->>'receipt_brand_mark_alt'), ''), 'Dama')
)),
    updated_at = NOW()
WHERE key = 'wallet_chrome';

-- Nested payments chrome (admin receipt document) if present.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments,receipt_brand_mark_alt}',
  to_jsonb(
    CASE
      WHEN lower(trim(COALESCE(value->'payments'->>'receipt_brand_mark_alt', ''))) = 'dama' THEN 'Dama'
      WHEN NULLIF(trim(COALESCE(value->'payments'->>'receipt_brand_mark_alt', '')), '') IS NOT NULL
        THEN trim(value->'payments'->>'receipt_brand_mark_alt')
      ELSE 'Dama'
    END
  ),
  true
),
    updated_at = NOW()
WHERE key = 'wallet_chrome'
  AND value ? 'payments';
