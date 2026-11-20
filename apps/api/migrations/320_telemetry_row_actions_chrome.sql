-- Telemetry OpsDataTable row actions chrome (fail-closed, no TS invent).
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
    'row_actions_label', COALESCE(
      NULLIF(trim(value->'telemetry'->>'row_actions_label'), ''),
      'Actions'
    )
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
