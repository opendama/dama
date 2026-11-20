-- Trim-parity: discrete search_label (never use placeholder as Field label) for ops filters.
UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      value,
      '{users}',
      COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
        'search_label', COALESCE(NULLIF(trim(value->'users'->>'search_label'), ''), 'Search')
      )
    ),
    '{avatars}',
    COALESCE(value->'avatars', '{}'::jsonb) || jsonb_build_object(
      'search_label', COALESCE(NULLIF(trim(value->'avatars'->>'search_label'), ''), 'Search'),
      'view_detail_action', COALESCE(NULLIF(trim(value->'avatars'->>'view_detail_action'), ''), 'View details'),
      'dialog_close_label', COALESCE(NULLIF(trim(value->'avatars'->>'dialog_close_label'), ''), 'Close'),
      'cancel_action', COALESCE(NULLIF(trim(value->'avatars'->>'cancel_action'), ''), 'Cancel'),
      'detail_title', COALESCE(NULLIF(trim(value->'avatars'->>'detail_title'), ''), 'Avatar details'),
      'col_user', COALESCE(NULLIF(trim(value->'avatars'->>'col_user'), ''), 'User'),
      'col_rating', COALESCE(NULLIF(trim(value->'avatars'->>'col_rating'), ''), 'Rating'),
      'search_placeholder', COALESCE(NULLIF(trim(value->'avatars'->>'search_placeholder'), ''), 'Search users')
    )
  ),
  '{media_pool}',
  COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
    'search_label', COALESCE(NULLIF(trim(value->'media_pool'->>'search_label'), ''), 'Search')
  )
),
  updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'search_label', COALESCE(NULLIF(trim(value->>'search_label'), ''), 'Search'),
  'search_placeholder', COALESCE(NULLIF(trim(value->>'search_placeholder'), ''), 'Search permissions')
),
  updated_at = NOW()
WHERE key = 'rbac_chrome';
