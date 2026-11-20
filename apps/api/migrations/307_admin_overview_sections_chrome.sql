-- Admin Overview: section titles + ops KPI labels (fail-closed chrome).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{dashboard}',
  COALESCE(value->'dashboard', '{}'::jsonb) || jsonb_build_object(
    'section_live_title',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'section_live_title'), ''),
      'Live pulse'
    ),
    'section_ops_title',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'section_ops_title'), ''),
      'Needs attention'
    ),
    'section_platform_title',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'section_platform_title'), ''),
      'Platform'
    ),
    'kpi_open_reports_label',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'kpi_open_reports_label'), ''),
      'Open reports'
    ),
    'kpi_hosted_cups_label',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'kpi_hosted_cups_label'), ''),
      'Hosted cups'
    ),
    'kpi_tournaments_label',
    COALESCE(
      NULLIF(trim(value->'dashboard'->>'kpi_tournaments_label'), ''),
      'Tournaments'
    )
  ),
  true
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
