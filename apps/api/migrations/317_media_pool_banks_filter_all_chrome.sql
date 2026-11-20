-- Admin media pool + banks list filters: status "All" label (Trim parity).
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    value,
    '{media_pool}',
    COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
      'filter_all_label', COALESCE(NULLIF(trim(value->'media_pool'->>'filter_all_label'), ''), 'All')
    )
  ),
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
    'filter_all_label', COALESCE(NULLIF(trim(value->'banks'->>'filter_all_label'), ''), 'All')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
