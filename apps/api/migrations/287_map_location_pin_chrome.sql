-- Leaflet map pin chrome for ad campaign geo targeting + admin telemetry map browse.
-- Mirrors smart-menu BranchLocationPinField / MenuBrowseMap labels (DB-backed, fail-closed).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'map_location_section_title',
  COALESCE(NULLIF(trim(value->>'map_location_section_title'), ''), 'Map location'),
  'map_pin_empty',
  COALESCE(
    NULLIF(trim(value->>'map_pin_empty'), ''),
    'Click the map or use device location to place the targeting pin.'
  ),
  'map_use_device_location',
  COALESCE(NULLIF(trim(value->>'map_use_device_location'), ''), 'Use device location'),
  'map_clear_pin',
  COALESCE(NULLIF(trim(value->>'map_clear_pin'), ''), 'Clear pin'),
  'map_helper_text',
  COALESCE(
    NULLIF(trim(value->>'map_helper_text'), ''),
    'Click the map to place the pin. Coordinates resolve country via server reverse geocode.'
  ),
  'map_geolocation_unavailable',
  COALESCE(
    NULLIF(trim(value->>'map_geolocation_unavailable'), ''),
    'Geolocation is not available in this browser.'
  ),
  'map_geolocation_failed',
  COALESCE(
    NULLIF(trim(value->>'map_geolocation_failed'), ''),
    'Could not read your device location.'
  ),
  'map_pin_required',
  COALESCE(
    NULLIF(trim(value->>'map_pin_required'), ''),
    'Map pin is required. Place a pin before creating the campaign.'
  ),
  'map_pin_coords_fmt',
  COALESCE(NULLIF(trim(value->>'map_pin_coords_fmt'), ''), 'Pin: {lat}, {lng}'),
  'map_listings_count_fmt',
  COALESCE(NULLIF(trim(value->>'map_listings_count_fmt'), ''), '{count} locations'),
  'map_locate_failed',
  COALESCE(
    NULLIF(trim(value->>'map_locate_failed'), ''),
    'Could not resolve country for this pin.'
  )
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
    'map_title',
    COALESCE(NULLIF(trim(value->'telemetry'->>'map_title'), ''), 'Geo map'),
    'map_empty_title',
    COALESCE(
      NULLIF(trim(value->'telemetry'->>'map_empty_title'), ''),
      'No map locations for these records'
    ),
    'map_empty_body',
    COALESCE(
      NULLIF(trim(value->'telemetry'->>'map_empty_body'), ''),
      'Geo IP rows need saved latitude and longitude to appear on the map.'
    ),
    'map_listings_count_fmt',
    COALESCE(
      NULLIF(trim(value->'telemetry'->>'map_listings_count_fmt'), ''),
      '{count} locations'
    ),
    'map_footer_hint',
    COALESCE(
      NULLIF(trim(value->'telemetry'->>'map_footer_hint'), ''),
      'Pins come from GPS reverse-geocode or GeoIP records with coordinates.'
    )
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
