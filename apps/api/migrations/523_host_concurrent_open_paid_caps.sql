-- Layer D: concurrent open paid-cup caps for hosts (DB-driven, fail-closed).
-- Phone-verified hosts get a low concurrent paid cup limit; document-verified hosts get a higher one.
-- Open = not finished and not cancelled. Free cups are not counted.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'host_concurrent_open_paid_cap_phone_verified',
  COALESCE(
    NULLIF(trim(value->>'host_concurrent_open_paid_cap_phone_verified'), '')::int,
    3
  ),
  'host_concurrent_open_paid_cap_document_verified',
  COALESCE(
    NULLIF(trim(value->>'host_concurrent_open_paid_cap_document_verified'), '')::int,
    25
  )
),
updated_at = NOW()
WHERE key = 'cash_rmg_policy';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_host_concurrent_open_paid_cap',
  COALESCE(
    NULLIF(trim(value->>'err_host_concurrent_open_paid_cap'), ''),
    'You already have the maximum number of open paid cups for your host trust tier. Finish or cancel one before creating another.'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
