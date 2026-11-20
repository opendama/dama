-- Split campaign create fee into Ethiopia vs global amounts (DB-driven).
-- Existing campaign_create_fee_amount/currency → Ethiopia; new global pair seeded.
-- Currencies align with payment_currency.ethiopia / payment_currency.global.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'campaign_create_fee_ethiopia_amount', COALESCE(
    NULLIF((NULLIF(trim(value->>'campaign_create_fee_ethiopia_amount'), ''))::numeric, 0),
    NULLIF((NULLIF(trim(value->>'campaign_create_fee_amount'), ''))::numeric, 0),
    25
  ),
  'campaign_create_fee_ethiopia_currency', upper(COALESCE(
    NULLIF(trim(value->>'campaign_create_fee_ethiopia_currency'), ''),
    NULLIF(trim((SELECT value->>'ethiopia' FROM platform_settings WHERE key = 'payment_currency')), ''),
    NULLIF(trim(value->>'campaign_create_fee_currency'), ''),
    'ETB'
  )),
  'campaign_create_fee_global_amount', COALESCE(
    NULLIF((NULLIF(trim(value->>'campaign_create_fee_global_amount'), ''))::numeric, 0),
    5
  ),
  'campaign_create_fee_global_currency', upper(COALESCE(
    NULLIF(trim(value->>'campaign_create_fee_global_currency'), ''),
    NULLIF(trim((SELECT value->>'global' FROM platform_settings WHERE key = 'payment_currency')), ''),
    'USD'
  ))
),
  updated_at = NOW()
WHERE key = 'ad_pricing';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'campaign_create_fee_ethiopia_label', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fee_ethiopia_label'), ''),
      'Ethiopia campaign create fee'
    ),
    'campaign_create_fees_section_title', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fees_section_title'), ''),
      'Campaign create fees'
    ),
    'campaign_create_fee_ethiopia_currency_label', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fee_ethiopia_currency_label'), ''),
      'Ethiopia campaign create fee currency'
    ),
    'campaign_create_fee_global_label', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fee_global_label'), ''),
      'Global campaign create fee'
    ),
    'campaign_create_fee_global_currency_label', COALESCE(
      NULLIF(trim(value->'progression'->>'campaign_create_fee_global_currency_label'), ''),
      'Global campaign create fee currency'
    ),
    'campaign_create_fee_geo_blurb', 'Ethiopia publishers are charged the Ethiopia fee in {ethiopia}. Publishers outside Ethiopia are charged the global fee in {global}.',
    'err_campaign_create_fee', 'Ethiopia and global campaign create fee amounts are required',
    'campaign_create_fee_label', 'Ethiopia campaign create fee',
    'campaign_create_fee_currency_label', 'Ethiopia campaign create fee currency'
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
