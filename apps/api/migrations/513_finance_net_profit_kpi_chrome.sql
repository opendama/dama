-- 513: Financial overview explicit net profit KPI (platform take / fees + commission).
-- Idempotent soft-fill. Amounts match platform_revenue; label is ops-facing "Net profit".

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'overview_kpi_net_profit',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_kpi_net_profit'), ''),
      'Net profit (fees + commission)'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
