-- Publisher campaigns list row-actions menu trigger (OpsDataTableRowActions).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'row_actions_label', COALESCE(NULLIF(trim(value->>'row_actions_label'), ''), 'Row actions')
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
