-- No schema change. Ensures mig 225 status label maps remain non-empty for every
-- hosted event / campaign / bracket status code (idempotent soft-fill for any
-- environments that applied 225 before label validation shipped).
UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{hosted_event_status_labels}',
  COALESCE(value->'hosted_event_status_labels', '{}'::jsonb) || '{
    "open": "Open",
    "full": "Full",
    "live": "Live",
    "finished": "Finished",
    "cancelled": "Cancelled"
  }'::jsonb
),
    updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{hosted_event_bracket_status_labels}',
  COALESCE(value->'hosted_event_bracket_status_labels', '{}'::jsonb) || '{
    "pending": "Pending",
    "ready": "Ready",
    "live": "Live",
    "done": "Done",
    "bye": "Bye"
  }'::jsonb
),
    updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{campaign_status_labels}',
  COALESCE(value->'campaign_status_labels', '{}'::jsonb) || '{
    "draft": "Draft",
    "active": "Active",
    "paused": "Paused",
    "archived": "Archived"
  }'::jsonb
),
    updated_at = NOW()
WHERE key = 'client_enums';
