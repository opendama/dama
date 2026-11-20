-- Admin chrome for public host fee multiplier (catalog field already exists; UI was missing).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'public_host_fee_multiplier_label',
    COALESCE(
      NULLIF(trim(value->>'public_host_fee_multiplier_label'), ''),
      'Public host fee multiplier'
    ),
    'public_host_fee_multiplier_blurb',
    COALESCE(
      NULLIF(trim(value->>'public_host_fee_multiplier_blurb'), ''),
      'Applied to the selected size host fee when visibility is public (1 = same as private).'
    )
  ),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';
