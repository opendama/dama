-- 514: Volume KPI labels must be period-neutral (period comes from 7/30/90 tablist).
-- Force-heal legacy "(7d)" suffixes so selected period is not contradicted.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'overview_kpi_topup_volume', 'Top-up volume',
    'overview_kpi_payout_volume', 'Payout volume',
    'overview_kpi_host_fee_volume', 'Host fee revenue',
    'overview_kpi_entry_commission', 'Entry commission',
    'overview_period_note',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_period_note'), ''),
      'Volume KPIs use the selected period in each currency.'
    )
  ),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
