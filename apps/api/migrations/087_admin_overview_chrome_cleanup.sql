-- Trim overview chrome: KPI home (not module index / signed-in strip).
-- 1) Overview nav body no longer says "module index".
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{modules}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN elem->>'href' = '/dashboard' THEN
            jsonb_set(elem, '{body}', '"Console home and live KPI summary."'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(value->'modules', '[]'::jsonb))
      WITH ORDINALITY AS t(elem, ord)
  ),
  true
),
updated_at = NOW()
WHERE key = 'console_nav'
  AND value ? 'modules';

-- 2) Drop unused auth "Signed in as" prefix (overview no longer renders it).
UPDATE platform_settings
SET value = value - 'signed_in_as_prefix',
    updated_at = NOW()
WHERE key = 'auth_providers'
  AND value ? 'signed_in_as_prefix';

-- 3) Drop unused dashboard signed-in KPI chrome keys.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '{}'::jsonb)
    - 'signed_in_joiner'
    - 'signed_in_suffix'
    - 'kpi_signed_in_label',
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'dashboard';
