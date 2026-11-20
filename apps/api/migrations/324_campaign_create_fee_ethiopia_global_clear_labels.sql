-- Clear parallel naming for dual campaign create fees (Ethiopia ETB + Global USD).
-- Existing fee controls are Ethiopia-only; global USD is the matching second pair.

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{progression}',
  COALESCE(value->'progression', '{}'::jsonb) || jsonb_build_object(
    'campaign_create_fees_section_title', 'Campaign create fees',
    'campaign_create_fee_ethiopia_label', 'Ethiopia campaign create fee',
    'campaign_create_fee_ethiopia_currency_label', 'Ethiopia campaign create fee currency',
    'campaign_create_fee_global_label', 'Global campaign create fee',
    'campaign_create_fee_global_currency_label', 'Global campaign create fee currency',
    'campaign_create_fee_geo_blurb', 'Ethiopia publishers are charged the Ethiopia fee in {ethiopia}. Publishers outside Ethiopia are charged the global fee in {global}.',
    'err_campaign_create_fee', 'Ethiopia and global campaign create fee amounts are required',
    -- Legacy aliases stay Ethiopia-scoped so older clients cannot show an ambiguous single fee.
    'campaign_create_fee_label', 'Ethiopia campaign create fee',
    'campaign_create_fee_currency_label', 'Ethiopia campaign create fee currency'
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';
