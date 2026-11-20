-- Remaining wallet geo errors + practice difficulty chrome (fail closed).

UPDATE platform_settings
SET value = value || '{
  "location_unavailable": "Location unavailable",
  "location_geo_failed": "Location unavailable from backend geo resolve",
  "country_unresolved": "Country unresolved. Tap Detect location or enter a country code from backend geo.",
  "payment_route_unavailable": "Payment route unavailable"
}'::jsonb,
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || '{
  "toast_options_load_failed": "Unable to load game options"
}'::jsonb,
updated_at = NOW()
WHERE key = 'play_chrome';
