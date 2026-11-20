-- Console public/dashboard brand casing for title template + meta (display only).
-- Idempotent. Does not touch modules hrefs, bots, or payment flag keys.

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'title_template', CASE
    WHEN trim(COALESCE(value->>'title_template', '')) ~* '\| dama console$'
      THEN regexp_replace(trim(value->>'title_template'), '\| [Dd]ama [Cc]onsole$', '| Dama Console')
    WHEN lower(trim(COALESCE(value->>'title_template', ''))) = 'dama console' THEN 'Dama Console'
    ELSE NULLIF(trim(value->>'title_template'), '')
  END,
  'meta_description', CASE
    WHEN trim(COALESCE(value->>'meta_description', '')) ~* '^dama '
      THEN regexp_replace(trim(value->>'meta_description'), '^[Dd]ama ', 'Dama ')
    ELSE NULLIF(trim(value->>'meta_description'), '')
  END
)),
    updated_at = NOW()
WHERE key = 'console_nav';
