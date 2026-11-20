-- Admin Payments: geo_payment CRUD chrome (domestic ISO + localhost invent city/region).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'geo_payment_section_title',
    COALESCE(
      NULLIF(trim(value->'payments'->>'geo_payment_section_title'), ''),
      'Pay geo (domestic + localhost invent)'
    ),
    'geo_payment_load_failed',
    COALESCE(
      NULLIF(trim(value->'payments'->>'geo_payment_load_failed'), ''),
      'Failed to load geo payment settings.'
    ),
    'geo_payment_ethiopia_country_label',
    COALESCE(
      NULLIF(trim(value->'payments'->>'geo_payment_ethiopia_country_label'), ''),
      'Domestic country (ISO)'
    ),
    'geo_payment_private_city_label',
    COALESCE(
      NULLIF(trim(value->'payments'->>'geo_payment_private_city_label'), ''),
      'Localhost invent city'
    ),
    'geo_payment_private_region_label',
    COALESCE(
      NULLIF(trim(value->'payments'->>'geo_payment_private_region_label'), ''),
      'Localhost invent region'
    ),
    'save_geo_payment_action',
    COALESCE(
      NULLIF(trim(value->'payments'->>'save_geo_payment_action'), ''),
      'Save pay geo'
    ),
    'save_geo_payment_pending',
    COALESCE(
      NULLIF(trim(value->'payments'->>'save_geo_payment_pending'), ''),
      'Saving pay geo…'
    ),
    'toast_geo_payment_saved',
    COALESCE(
      NULLIF(trim(value->'payments'->>'toast_geo_payment_saved'), ''),
      'Pay geo saved'
    ),
    'toast_geo_payment_failed',
    COALESCE(
      NULLIF(trim(value->'payments'->>'toast_geo_payment_failed'), ''),
      'Pay geo save failed'
    )
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
