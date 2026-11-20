-- Entry roster status labels (organizer players tab); UI must not invent English from codes.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "hosted_event_entry_status_labels": {
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected",
    "kicked": "Kicked"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'client_enums';
