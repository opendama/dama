-- Heal spend-cap chrome: column label must stay distinct from impression daily_cap_label
-- and from long form placeholders (e.g. "Max spend per day (e.g. 500)").

UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'daily_spend_cap_label', 'Daily spend cap',
    'daily_spend_cap_suffix', COALESCE(
      NULLIF(trim(value->>'daily_spend_cap_suffix'), ''),
      'daily spend cap'
    ),
    'ph_daily_spend_cap', CASE
      WHEN NULLIF(trim(value->>'ph_daily_spend_cap'), '') IS NULL THEN 'Daily spend cap (required)'
      WHEN lower(trim(value->>'ph_daily_spend_cap')) IN (
        'max spend per day (e.g. 500)',
        'daily spend cap',
        'daily spend cap (local currency)',
        'ph_daily_spend_cap'
      ) THEN 'Daily spend cap (required)'
      ELSE trim(value->>'ph_daily_spend_cap')
    END,
    'err_daily_spend_cap_required', COALESCE(
      NULLIF(trim(value->>'err_daily_spend_cap_required'), ''),
      'Daily spend cap is required and must be greater than zero.'
    ),
    'daily_spend_cap_required_hint', COALESCE(
      NULLIF(trim(value->>'daily_spend_cap_required_hint'), ''),
      'Required. Caps how much this campaign can spend per day from impressions. Separate from the one-time create fee charged to your wallet.'
    )
  ),
  updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
