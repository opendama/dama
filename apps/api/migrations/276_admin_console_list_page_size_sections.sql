-- Admin console list_page_size for banks/media_pool/avatars/telemetry/users (no client invent of 25).
-- Payments already has list_page_size (mig 275). Tournament console uses tournament_chrome separately.

UPDATE platform_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{banks}',
          COALESCE(value->'banks', '{}'::jsonb) || jsonb_build_object(
            'list_page_size',
            COALESCE(NULLIF(trim(value->'banks'->>'list_page_size'), ''), '25')
          )
        ),
        '{media_pool}',
        COALESCE(value->'media_pool', '{}'::jsonb) || jsonb_build_object(
          'list_page_size',
          COALESCE(NULLIF(trim(value->'media_pool'->>'list_page_size'), ''), '25')
        )
      ),
      '{avatars}',
      COALESCE(value->'avatars', '{}'::jsonb) || jsonb_build_object(
        'list_page_size',
        COALESCE(NULLIF(trim(value->'avatars'->>'list_page_size'), ''), '25')
      )
    ),
    '{telemetry}',
    COALESCE(value->'telemetry', '{}'::jsonb) || jsonb_build_object(
      'list_page_size',
      COALESCE(NULLIF(trim(value->'telemetry'->>'list_page_size'), ''), '25')
    )
  ),
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
    'list_page_size',
    COALESCE(NULLIF(trim(value->'users'->>'list_page_size'), ''), '25')
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_page_size',
  COALESCE(NULLIF(trim(value->>'list_page_size'), ''), '25')
),
    updated_at = NOW()
WHERE key = 'tournament_chrome';
