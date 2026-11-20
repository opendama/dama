-- Fix mojibake in outcomes meta format (UTF-8 middle dot · was stored as Â·).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{activity,breakdown_outcomes_meta_fmt}',
  to_jsonb('Decisive rate {pct}% · {n} matches'::text),
  true
),
updated_at = NOW()
WHERE key = 'admin_console_chrome'
  AND value ? 'activity'
  AND COALESCE(value->'activity'->>'breakdown_outcomes_meta_fmt', '') ~ 'Â';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'breakdown_outcomes_meta_fmt', 'Decisive rate {pct}% · {n} matches'
),
updated_at = NOW()
WHERE key = 'platform_stats_chrome'
  AND COALESCE(value->>'breakdown_outcomes_meta_fmt', '') ~ 'Â';
