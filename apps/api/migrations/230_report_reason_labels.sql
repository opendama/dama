-- DB-driven labels for event report reason codes (UI must not invent English from codes).
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "report_reason_labels": {
    "spam": "Spam",
    "abuse": "Abuse",
    "offensive_name": "Offensive name",
    "other": "Other"
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'events_catalog';

-- Payments tab: gross collected label (commission/net already on payments_* keys).
UPDATE platform_settings
SET value = value
  || jsonb_build_object(
    'entry_fees_gross_label',
    COALESCE(
      NULLIF(trim(value->>'entry_fees_gross_label'), ''),
      'Entry fees (gross)'
    )
  ),
  updated_at = NOW()
WHERE key = 'events_organizer_chrome';
