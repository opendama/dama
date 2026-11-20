-- Profile avatar: click-to-upload chrome + clearer inspect hint (no separate upload button).
UPDATE platform_settings
SET value = value || '{
  "change_photo_aria": "Change profile photo",
  "tap_inspect_hint": "Tap photo to change - tap name to inspect"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'avatar_chrome';