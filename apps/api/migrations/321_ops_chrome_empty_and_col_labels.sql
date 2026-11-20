-- Ops chrome: discrete column/field labels + empty_value (fail-closed, no TS invent).
-- Seeds new keys from existing prefix/placeholder strings where present (strip trailing :/space).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'doc_kyc_col_when', COALESCE(
      NULLIF(trim(value->'payments'->>'doc_kyc_col_when'), ''),
      NULLIF(trim(value->'payments'->>'txn_col_when'), ''),
      'When'
    ),
    'payout_col_user', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_user'), ''),
      NULLIF(trim(both ' :' from COALESCE(value->'payments'->>'payout_user_prefix', '')), ''),
      'User'
    ),
    'payout_col_amount', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_amount'), ''),
      NULLIF(trim(both ' :' from COALESCE(value->'payments'->>'payout_amount_prefix', '')), ''),
      'Amount'
    ),
    'payout_col_status', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_status'), ''),
      NULLIF(trim(both ' :' from COALESCE(value->'payments'->>'payout_status_prefix', '')), ''),
      'Status'
    ),
    'payout_col_phone', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_phone'), ''),
      NULLIF(trim(both ' :' from COALESCE(value->'payments'->>'payout_phone_prefix', '')), ''),
      'Phone'
    ),
    'payout_col_provider', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_provider'), ''),
      NULLIF(trim(value->'payments'->>'receipt_col_provider'), ''),
      'Provider'
    ),
    'payout_col_when', COALESCE(
      NULLIF(trim(value->'payments'->>'payout_col_when'), ''),
      NULLIF(trim(value->'payments'->>'txn_col_when'), ''),
      NULLIF(trim(value->'payments'->>'receipt_col_when'), ''),
      'When'
    )
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{banks}',
  COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'banks'->>'empty_value'), ''), '-'),
    'col_label', COALESCE(
      NULLIF(trim(value->'banks'->>'col_label'), ''),
      NULLIF(trim(value->'banks'->>'label_placeholder'), ''),
      'Label'
    ),
    'provider_label', COALESCE(
      NULLIF(trim(value->'banks'->>'provider_label'), ''),
      NULLIF(trim(value->'banks'->>'col_provider'), ''),
      'Provider'
    ),
    'label_label', COALESCE(
      NULLIF(trim(value->'banks'->>'label_label'), ''),
      NULLIF(trim(value->'banks'->>'label_placeholder'), ''),
      'Label'
    ),
    'account_label', COALESCE(
      NULLIF(trim(value->'banks'->>'account_label'), ''),
      NULLIF(trim(value->'banks'->>'account_placeholder'), ''),
      'Account number'
    ),
    'mobile_label', COALESCE(
      NULLIF(trim(value->'banks'->>'mobile_label'), ''),
      NULLIF(trim(value->'banks'->>'mobile_placeholder'), ''),
      'Mobile code'
    )
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'users'->>'empty_value'), ''), '-')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{avatars}',
  COALESCE(value->'avatars', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'avatars'->>'empty_value'), ''), '-'),
    'detail_id_label', COALESCE(
      NULLIF(trim(value->'avatars'->>'detail_id_label'), ''),
      'ID'
    ),
    'thumbnail_label', COALESCE(
      NULLIF(trim(value->'avatars'->>'thumbnail_label'), ''),
      NULLIF(trim(value->'avatars'->>'avatar_proof_caption'), ''),
      'Avatar'
    )
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{telemetry}',
  COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'telemetry'->>'empty_value'), ''), '-')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
    'empty_value', COALESCE(NULLIF(trim(value->'media_pool'->>'empty_value'), ''), '-'),
    'upload_title_label', COALESCE(
      NULLIF(trim(value->'media_pool'->>'upload_title_label'), ''),
      NULLIF(trim(value->'media_pool'->>'upload_title_placeholder'), ''),
      'Ad creative title'
    )
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'thumbnail_label', COALESCE(
    NULLIF(trim(value->>'thumbnail_label'), ''),
    NULLIF(trim(value->>'detail_logo_label'), ''),
    NULLIF(trim(value->>'logo_label'), ''),
    'Event logo'
  )
),
  updated_at = NOW()
WHERE key = 'events_admin_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'permissions_empty', COALESCE(
    NULLIF(trim(value->>'permissions_empty'), ''),
    'No permissions'
  )
),
  updated_at = NOW()
WHERE key = 'rbac_chrome';
