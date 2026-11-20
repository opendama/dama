-- Smart-menu-parity thumbnail/gallery chrome (tournaments + ads).
-- gallery_max_slots is the additional-gallery capacity (thumbnail is separate).

UPDATE platform_settings
SET value = value || '{
  "gallery_max_slots": "9",
  "gallery_slots_fmt": "{count} / {max}",
  "thumbnail_main_badge": "Main Image",
  "thumbnail_empty_hint": "Upload main image",
  "thumbnail_hint": "Master image is what players see first. Recommended: 800x800px square.",
  "gallery_limit_reached": "Gallery limit reached"
}'::jsonb,
updated_at = NOW()
WHERE key = 'tournament_chrome';

UPDATE platform_settings
SET value = value || '{
  "gallery_max_slots": "9",
  "gallery_slots_fmt": "{count} / {max}",
  "thumbnail_main_badge": "Main Image",
  "thumbnail_empty_hint": "Upload main image",
  "thumbnail_hint": "Master image is what guests see first on cards. Recommended: 800x800px square.",
  "gallery_limit_reached": "Gallery limit reached"
}'::jsonb,
updated_at = NOW()
WHERE key = 'ad_runtime_chrome';
