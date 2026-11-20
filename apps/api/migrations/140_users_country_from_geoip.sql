-- Persist profile country from verified GeoIP records (no invented defaults).
-- Backfill users.country_code / region from latest geoip-sourced locate only.
UPDATE users u
SET
  country_code = upper(g.country_code),
  region = COALESCE(NULLIF(trim(g.region), ''), u.region),
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    country_code,
    region
  FROM geo_ip_records
  WHERE source = 'geoip'
    AND country_code IS NOT NULL
    AND length(trim(country_code)) = 2
  ORDER BY user_id, created_at DESC
) g
WHERE u.id = g.user_id
  AND (u.country_code IS NULL OR trim(u.country_code) = '');
