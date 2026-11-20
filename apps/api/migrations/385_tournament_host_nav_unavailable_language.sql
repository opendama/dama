-- Mig 385: Host portal nav unavailable chrome - Hosting wording (not Event sport).
-- Idempotent. Admin ops Events catalog unchanged.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{events_nav_unavailable}',
  to_jsonb('Hosting navigation unavailable'::text)
),
updated_at = NOW()
WHERE key = 'client_nav'
  AND COALESCE(value->>'events_nav_unavailable', '') ILIKE '%event%';
