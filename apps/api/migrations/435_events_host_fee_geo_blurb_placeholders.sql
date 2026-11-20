-- Ads parity: host fee geo blurb uses {ethiopia}/{global} from payment_currency, not hardcoded ETB/USD.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_fee_geo_blurb', 'Ethiopia organizers are charged the Ethiopia host fee in {ethiopia}. Organizers outside Ethiopia are charged the global host fee in {global}.'
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';
