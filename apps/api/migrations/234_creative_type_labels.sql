-- DB-driven creative type labels (clients must not invent English from raw codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "creative_type_labels": {
    "image": "Image",
    "video": "Video"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';
