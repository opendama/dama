-- Map pin UI replaced manual lat/lng fields. Keep keys in JSON for older clients
-- but scrub invent-style placeholders; fail-closed no longer requires ph_lat/ph_lng.
-- err_map_* must be present for server pin enforcement (mig 288 + typed ready check).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'ph_lat', '',
  'ph_lng', '',
  'err_map_pin_required',
  COALESCE(
    NULLIF(trim(value->>'err_map_pin_required'), ''),
    COALESCE(NULLIF(trim(value->>'map_pin_required'), ''), 'Map pin is required. Place a pin before creating the campaign.')
  ),
  'err_map_locate_failed',
  COALESCE(
    NULLIF(trim(value->>'err_map_locate_failed'), ''),
    COALESCE(NULLIF(trim(value->>'map_locate_failed'), ''), 'Could not resolve country for this pin.')
  )
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
