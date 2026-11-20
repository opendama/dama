-- Backfill older DBs seeded with series_max_buckets:93 (pre-fix 171). Fresh 171 seeds 366.
-- Year window is 365 days; LoadConfig requires buckets ≥ max period_window_days.

UPDATE platform_settings
SET value = jsonb_set(value, '{series_max_buckets}', '366'::jsonb),
    updated_at = NOW()
WHERE key = 'activity_analytics'
  AND COALESCE((value->>'series_max_buckets')::int, 0) < 366;
