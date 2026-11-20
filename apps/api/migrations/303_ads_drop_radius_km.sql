-- Drop publisher ad target radius (worldwide country/region/district matching only).
-- Safe: does not touch events UI border-radius chrome or Smart Menu near-me.

-- 1) Remove form chrome key (fail-closed clients must not require it).
UPDATE platform_settings
SET value = value - 'ph_radius_km',
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome'
  AND value ? 'ph_radius_km';

-- 2) Scrub radius_km from stored campaign geo_targets JSON (keep lat/lng/country/region/district).
UPDATE ad_campaigns
SET geo_targets = COALESCE((
  SELECT jsonb_agg(elem - 'radius_km')
  FROM jsonb_array_elements(COALESCE(geo_targets, '[]'::jsonb)) AS elem
), '[]'::jsonb),
    updated_at = NOW()
WHERE geo_targets IS NOT NULL
  AND geo_targets::text LIKE '%radius_km%';
