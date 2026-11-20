-- DB-driven viewport aspect tolerance + max video bytes (no invent in code).
-- Mark one-shot backfill/seed flags so re-applies of 478/479 do not repeat side effects
-- on environments that already received the original 478/479 runs.

INSERT INTO platform_settings (key, value, updated_at)
VALUES
  ('ad_viewport_slot_backfill_v1', 'true'::jsonb, NOW()),
  ('youtube_channels_sort_order_seed_v1', 'true'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || (
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM (
    VALUES
      ('viewport_aspect_tolerance', to_jsonb('0.08'::text)),
      ('viewport_max_video_bytes', to_jsonb('104857600'::text))
  ) AS t(k, v)
  WHERE NOT (COALESCE(platform_settings.value, '{}'::jsonb) ? k)
),
    updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
