-- Distinct spend-cap list/detail suffix (never reuse impression daily_cap_suffix).
-- Heal daily_spend_cap_label if older DBs still lack it.

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'daily_spend_cap_label', COALESCE(
      NULLIF(trim(value->>'daily_spend_cap_label'), ''),
      NULLIF(trim(value->>'ph_daily_spend_cap'), ''),
      'Daily spend cap'
    ),
    'daily_spend_cap_suffix', COALESCE(
      NULLIF(trim(value->>'daily_spend_cap_suffix'), ''),
      'daily spend cap'
    )
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
