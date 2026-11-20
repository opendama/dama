-- Admin ops detail modals: filter "All", detail id/user labels, banks account name, telemetry UA, events hosted detail.
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{users}',
      COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
        'filter_all_label', COALESCE(NULLIF(trim(value->'users'->>'filter_all_label'), ''), 'All'),
        'col_country_label', COALESCE(NULLIF(trim(value->'users'->>'col_country_label'), ''), 'Country'),
        'detail_id_label', COALESCE(NULLIF(trim(value->'users'->>'detail_id_label'), ''), 'User ID')
      )
    ),
    '{payments}',
    COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
      'detail_id_label', COALESCE(NULLIF(trim(value->'payments'->>'detail_id_label'), ''), 'ID'),
      'detail_user_id_label', COALESCE(NULLIF(trim(value->'payments'->>'detail_user_id_label'), ''), 'User ID')
    )
  ),
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
    'account_name_label', COALESCE(NULLIF(trim(value->'banks'->>'account_name_label'), ''), 'Account name')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
    'col_user_agent', COALESCE(NULLIF(trim(value->'telemetry'->>'col_user_agent'), ''), 'User agent'),
    'detail_id_label', COALESCE(NULLIF(trim(value->'telemetry'->>'detail_id_label'), ''), 'Record ID'),
    'detail_user_id_label', COALESCE(NULLIF(trim(value->'telemetry'->>'detail_user_id_label'), ''), 'User ID')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'detail_brand_color_label', COALESCE(NULLIF(trim(value->>'detail_brand_color_label'), ''), 'Brand color'),
  'detail_winner_label', COALESCE(NULLIF(trim(value->>'detail_winner_label'), ''), 'Winner')
),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';
