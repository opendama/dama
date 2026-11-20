-- 512: Financial overview net cashflow KPI (top-ups minus payouts).
-- Idempotent soft-fill.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'overview_kpi_net_cashflow',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_kpi_net_cashflow'), ''),
      'Net cashflow (top-ups minus payouts)'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
