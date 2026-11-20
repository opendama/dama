-- Layer B: first-time hosts get a lower concurrent open paid-cup cap until they
-- finish N settled (finished) paid cups. Document-verified hosts keep the doc cap.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'host_new_host_settled_paid_threshold',
  COALESCE(
    NULLIF(trim(value->>'host_new_host_settled_paid_threshold'), '')::int,
    3
  ),
  'host_concurrent_open_paid_cap_new_host',
  COALESCE(
    NULLIF(trim(value->>'host_concurrent_open_paid_cap_new_host'), '')::int,
    1
  )
),
updated_at = NOW()
WHERE key = 'cash_rmg_policy';
