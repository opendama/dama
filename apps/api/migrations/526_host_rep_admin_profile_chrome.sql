-- Host reputation chrome labels for admin console + profile inspect surfaces.

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_rep_finished_label',
  COALESCE(NULLIF(trim(value->>'host_rep_finished_label'), ''), 'Finished'),
  'host_rep_cancelled_label',
  COALESCE(NULLIF(trim(value->>'host_rep_cancelled_label'), ''), 'Cancelled'),
  'host_rep_reports_label',
  COALESCE(NULLIF(trim(value->>'host_rep_reports_label'), ''), 'Open reports'),
  'host_rep_meta_separator',
  COALESCE(NULLIF(trim(value->>'host_rep_meta_separator'), ''), ' · ')
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'host_rep_finished_label',
  COALESCE(NULLIF(trim(value->>'host_rep_finished_label'), ''), 'Finished'),
  'host_rep_cancelled_label',
  COALESCE(NULLIF(trim(value->>'host_rep_cancelled_label'), ''), 'Cancelled'),
  'host_rep_reports_label',
  COALESCE(NULLIF(trim(value->>'host_rep_reports_label'), ''), 'Open reports'),
  'host_rep_meta_separator',
  COALESCE(NULLIF(trim(value->>'host_rep_meta_separator'), ''), ' · ')
),
updated_at = NOW()
WHERE key = 'profile_inspect_chrome';
