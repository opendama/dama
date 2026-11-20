-- 510: Force-heal checked-in start copy on tournament_chrome;
-- financial overview period tabs (7/30/90) + platform revenue KPI chrome.
-- Idempotent.

-- ---------------------------------------------------------------------------
-- Official start toast: always the checked-in seats message (override short legacy).
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'not_enough_players',
  'Not enough checked-in players to start. Approved players must check in first.'
),
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'not_enough_players',
  'Not enough checked-in players to start. Approved players must check in first.'
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

-- ---------------------------------------------------------------------------
-- Financial overview: period filter labels + platform revenue KPI
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'overview_period_7d',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_period_7d'), ''), '7 days'),
    'overview_period_30d',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_period_30d'), ''), '30 days'),
    'overview_period_90d',
    COALESCE(NULLIF(trim(value->'payments'->>'overview_period_90d'), ''), '90 days'),
    'overview_kpi_platform_revenue',
    COALESCE(
      NULLIF(trim(value->'payments'->>'overview_kpi_platform_revenue'), ''),
      'Platform revenue (fees + commission)'
    ),
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
