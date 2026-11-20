-- Admin payouts list: show reviewed_at with DB chrome prefix (parity with player history).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{payments}',
  COALESCE(value->'payments', '{}'::jsonb) || jsonb_build_object(
    'payout_reviewed_at_prefix',
    COALESCE(
      NULLIF(trim(value->'payments'->>'payout_reviewed_at_prefix'), ''),
      'Reviewed'
    ),
    'payout_note_prefix',
    COALESCE(
      NULLIF(trim(value->'payments'->>'payout_note_prefix'), ''),
      'Note'
    )
  )
),
    updated_at = NOW()
WHERE key = 'admin_console_chrome';
