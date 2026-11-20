-- Exact-slot serve: desktop/tablet/mobile creatives only on their screen band.
-- Soft-replace outdated blurb that promised cross-slot fallback.
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{viewport_creatives_blurb}',
  to_jsonb('Upload image or video for each screen. You can fill all three or only the sizes you need. Players see only the creative for their screen size (desktop, tablet, or mobile).'::text),
  true
),
updated_at = NOW()
WHERE key = 'ad_runtime_chrome'
  AND COALESCE(value->>'viewport_creatives_blurb', '') LIKE '%fall back%';
;
