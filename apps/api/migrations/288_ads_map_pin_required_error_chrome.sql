-- Campaign create: map pin required + locate failed (server-side pin enforcement).

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
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
