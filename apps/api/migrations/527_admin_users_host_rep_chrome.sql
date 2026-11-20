-- Host reputation chrome labels for admin console users section.

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{users}',
  COALESCE(value->'users', '{}'::jsonb) || jsonb_build_object(
    'host_rep_finished_label',
    COALESCE(NULLIF(trim(value->'users'->>'host_rep_finished_label'), ''), 'Finished'),
    'host_rep_cancelled_label',
    COALESCE(NULLIF(trim(value->'users'->>'host_rep_cancelled_label'), ''), 'Cancelled'),
    'host_rep_reports_label',
    COALESCE(NULLIF(trim(value->'users'->>'host_rep_reports_label'), ''), 'Open reports'),
    'host_rep_meta_separator',
    COALESCE(NULLIF(trim(value->'users'->>'host_rep_meta_separator'), ''), ' · ')
  )
),
updated_at = NOW()
WHERE key = 'admin_console_chrome';
