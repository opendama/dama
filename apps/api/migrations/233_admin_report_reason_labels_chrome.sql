-- Admin catalog: edit report reason display labels (codes stay machine keys).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'report_reasons_title',
    COALESCE(
      NULLIF(trim(value->>'report_reasons_title'), ''),
      'Report reasons'
    ),
    'report_reasons_blurb',
    COALESCE(
      NULLIF(trim(value->>'report_reasons_blurb'), ''),
      'Labels shown when players report an event. Codes stay machine keys.'
    ),
    'report_reason_code_label',
    COALESCE(
      NULLIF(trim(value->>'report_reason_code_label'), ''),
      'Reason code'
    )
  ),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';
