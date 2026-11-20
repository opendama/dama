-- Force-heal official_pause_chrome: replace unicode ellipsis / middle-dot / dashes with ASCII.
-- Idempotent. Does not invent new keys.
UPDATE platform_settings
SET value = (
  SELECT COALESCE(jsonb_object_agg(e.key, to_jsonb(cleaned.v)), '{}'::jsonb)
  FROM jsonb_each_text(COALESCE(platform_settings.value, '{}'::jsonb)) AS e(key, value)
  CROSS JOIN LATERAL (
    SELECT replace(
      replace(
        replace(
          replace(e.value, E'\u2026', '...'),
          E'\u2014',
          '-'
        ),
        E'\u2013',
        '-'
      ),
      E' \u00b7 ',
      ' - '
    ) AS v
  ) AS cleaned
),
updated_at = NOW()
WHERE key = 'official_pause_chrome';
