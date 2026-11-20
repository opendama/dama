-- DB-driven visibility display labels (admin/organizer/player must not invent English from codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "hosted_event_visibility_labels": {
    "private": "Private",
    "public": "Public"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';
