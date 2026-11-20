-- Layer D: host reputation stats (finished/cancelled paid cups + open reports).
-- Visible on lobby cards; can block paid create when thresholds are breached.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'host_reputation_max_open_reports',
  COALESCE(
    NULLIF(trim(value->>'host_reputation_max_open_reports'), '')::int,
    5
  ),
  'host_reputation_cancel_rate_bps',
  COALESCE(
    NULLIF(trim(value->>'host_reputation_cancel_rate_bps'), '')::int,
    7000
  ),
  'host_reputation_cancel_rate_min_sample',
  COALESCE(
    NULLIF(trim(value->>'host_reputation_cancel_rate_min_sample'), '')::int,
    5
  )
),
updated_at = NOW()
WHERE key = 'cash_rmg_policy';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'err_host_reputation_blocked',
  COALESCE(
    NULLIF(trim(value->>'err_host_reputation_blocked'), ''),
    'Your host reputation is too low to create another paid cup. Resolve open reports or reduce cancellations, then try again.'
  )
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';

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
WHERE key = 'events_player_chrome';

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
WHERE key = 'events_organizer_chrome';
