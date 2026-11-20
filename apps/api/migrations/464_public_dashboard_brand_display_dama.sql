-- Public / dashboard shell brand display: product name "Dama" (title case).
-- Renames only shell brand strings next to logos (client_nav / console_nav / app_shell).
-- Idempotent. Does not touch payment geo, bots, or game logic.

-- Player + ads public/dashboard brands + browser tab defaults.
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_name', CASE
    WHEN lower(trim(COALESCE(value->>'brand_name', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'brand_name'), '')
  END,
  'ads_brand_name', CASE
    WHEN lower(trim(COALESCE(value->>'ads_brand_name', ''))) IN ('dama ads', 'dama') THEN 'Dama Ads'
    WHEN lower(trim(COALESCE(value->>'ads_brand_name', ''))) LIKE 'dama %'
      THEN 'Dama' || substr(trim(value->>'ads_brand_name'), 5)
    ELSE NULLIF(trim(value->>'ads_brand_name'), '')
  END,
  'site_title_default', CASE
    WHEN lower(trim(COALESCE(value->>'site_title_default', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'site_title_default'), '')
  END,
  'site_title_template', CASE
    WHEN trim(COALESCE(value->>'site_title_template', '')) ~* '\| dama$'
      THEN regexp_replace(trim(value->>'site_title_template'), '\| [Dd]ama$', '| Dama')
    WHEN lower(trim(COALESCE(value->>'site_title_template', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'site_title_template'), '')
  END
)),
    updated_at = NOW()
WHERE key = 'client_nav';

-- Soft-fill if brand keys were blank (public shell only).
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_name', COALESCE(NULLIF(trim(value->>'brand_name'), ''), 'Dama'),
  'ads_brand_name', COALESCE(NULLIF(trim(value->>'ads_brand_name'), ''), 'Dama Ads'),
  'site_title_default', COALESCE(NULLIF(trim(value->>'site_title_default'), ''), 'Dama')
)),
    updated_at = NOW()
WHERE key = 'client_nav';

-- Admin console brand next to logo on dashboards.
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_title', CASE
    WHEN lower(trim(COALESCE(value->>'brand_title', ''))) IN ('dama console', 'dama') THEN 'Dama Console'
    WHEN lower(trim(COALESCE(value->>'brand_title', ''))) LIKE 'dama %'
      THEN 'Dama' || substr(trim(value->>'brand_title'), 5)
    ELSE NULLIF(trim(value->>'brand_title'), '')
  END
)),
    updated_at = NOW()
WHERE key = 'console_nav';

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_title', COALESCE(NULLIF(trim(value->>'brand_title'), ''), 'Dama Console')
)),
    updated_at = NOW()
WHERE key = 'console_nav';

-- Splash / PWA / favicon alt: product name for mark + wordmark text.
UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_mark_alt', CASE
    WHEN lower(trim(COALESCE(value->>'brand_mark_alt', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'brand_mark_alt'), '')
  END,
  'manifest_name', CASE
    WHEN lower(trim(COALESCE(value->>'manifest_name', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'manifest_name'), '')
  END,
  'manifest_short_name', CASE
    WHEN lower(trim(COALESCE(value->>'manifest_short_name', ''))) = 'dama' THEN 'Dama'
    ELSE NULLIF(trim(value->>'manifest_short_name'), '')
  END
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';

UPDATE platform_settings
SET value = value || jsonb_strip_nulls(jsonb_build_object(
  'brand_mark_alt', COALESCE(NULLIF(trim(value->>'brand_mark_alt'), ''), 'Dama'),
  'manifest_name', COALESCE(NULLIF(trim(value->>'manifest_name'), ''), 'Dama'),
  'manifest_short_name', COALESCE(NULLIF(trim(value->>'manifest_short_name'), ''), 'Dama')
)),
    updated_at = NOW()
WHERE key = 'app_shell_chrome';
