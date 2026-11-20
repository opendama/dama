-- Mig 408: Marketing footer guest Tournaments browse (Official|Community hub).
-- Docs claim marketing footer Tournaments guest browse; live marketing had no
-- tournaments row (only Player/Play/Wallet/Ads/legal). One Tournament word -
-- never Event browse. Idempotent. Backend tables unmerged.

-- Fix existing marketing tournaments row (legacy /tournaments or Event href).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{marketing}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN COALESCE(el->>'route_key', '') = 'tournaments' THEN
            jsonb_build_object(
              'title', 'Tournaments',
              'href', '/?view=tournaments',
              'route_key', 'tournaments'
            )
          ELSE el
        END
        ORDER BY ord
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb))
      WITH ORDINALITY AS t(el, ord)
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'tournaments'
      AND (
        COALESCE(el->>'href', '') IS DISTINCT FROM '/?view=tournaments'
        OR COALESCE(el->>'title', '') IS DISTINCT FROM 'Tournaments'
        OR COALESCE(el->>'href', '') ~* 'view=events'
        OR COALESCE(el->>'href', '') LIKE '%/events/public%'
      )
  );

-- Insert Tournaments after Play when missing (guest-safe hub).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{marketing}',
  (
    WITH elems AS (
      SELECT el, ord
      FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb))
        WITH ORDINALITY AS t(el, ord)
    ),
    play_ord AS (
      SELECT COALESCE(MAX(ord), 0)::numeric AS o
      FROM elems
      WHERE el->>'route_key' = 'play'
    )
    SELECT COALESCE(
      jsonb_agg(x ORDER BY sort_key),
      '[{"title":"Tournaments","href":"/?view=tournaments","route_key":"tournaments"}]'::jsonb
    )
    FROM (
      SELECT el AS x, ord::numeric AS sort_key FROM elems
      UNION ALL
      SELECT
        jsonb_build_object(
          'title', 'Tournaments',
          'href', '/?view=tournaments',
          'route_key', 'tournaments'
        ),
        (SELECT o FROM play_ord) + 0.5
    ) u
  )
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(value->'marketing', '[]'::jsonb)) el
    WHERE el->>'route_key' = 'tournaments'
  );
