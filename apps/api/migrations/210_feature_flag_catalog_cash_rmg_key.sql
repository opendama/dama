-- Feature flag catalog: DB-driven cash RMG flag key (parity with ai_depths_flag_key).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'cash_rmg_flag_key', COALESCE(NULLIF(trim(value->>'cash_rmg_flag_key'), ''), 'cash_rmg_enabled')
),
    updated_at = NOW()
WHERE key = 'feature_flag_catalog';
