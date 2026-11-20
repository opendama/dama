-- Tournament status display labels (admin Ops; no raw-code invent).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "tournament_status_labels": {
    "draft": "Draft",
    "open": "Open",
    "archived": "Archived"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';

-- Tournament admin chrome empty cell (fail-closed when label map miss).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "empty_value": "-"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'tournament_chrome';
