-- Display copy only: remove Ethiopia-local marketing labels from console/feature UI.
-- Does NOT rename flag keys (ethiopian_payment_mode stays for payment geo logic).
-- Idempotent.

-- console_nav Feature flags module blurb
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(m->>'href', '') = '/feature-flags'
          AND COALESCE(m->>'body', '') ~* 'ethiopian'
          THEN m || jsonb_build_object(
            'body', 'Toggle VS-AI practice, OTP gate, and domestic payment mode.'
          )
        ELSE m
      END
      ORDER BY ord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb))
      WITH ORDINALITY AS t(m, ord)
  )
),
    updated_at = NOW()
WHERE key = 'console_nav'
  AND value ? 'modules'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb)) m
    WHERE COALESCE(m->>'body', '') ~* 'ethiopian'
  );

-- feature_flag_catalog toggle display title/description (key unchanged)
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN COALESCE(t->>'key', '') = 'ethiopian_payment_mode' THEN
          t
          || jsonb_build_object(
            'title', 'Domestic payment mode',
            'description', CASE
              WHEN COALESCE(t->>'description', '') ~* 'ethiopian|ethiopia'
                THEN 'Domestic gateway mode for local checkout and manual transfer.'
              ELSE COALESCE(NULLIF(trim(t->>'description'), ''), 'Domestic gateway mode for local checkout and manual transfer.')
            END
          )
        ELSE t
      END
      ORDER BY ord
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb))
      WITH ORDINALITY AS x(t, ord)
  )
),
    updated_at = NOW()
WHERE key = 'feature_flag_catalog'
  AND value ? 'toggles'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) t
    WHERE COALESCE(t->>'key', '') = 'ethiopian_payment_mode'
      AND (
        COALESCE(t->>'title', '') ~* 'ethiopian'
        OR COALESCE(t->>'description', '') ~* 'ethiopian|ethiopia'
      )
  );
