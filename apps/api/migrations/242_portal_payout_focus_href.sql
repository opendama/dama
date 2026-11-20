-- Portal Payout CTAs deep-link into the wallet payout section (not just /wallet).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "portal_payout_href": "/events/wallet?focus=payout"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_organizer_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "publisher_portal_payout_href": "/ads/wallet?focus=payout"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
