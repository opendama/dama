-- Re-assert core wallet ledger kind labels (fail-closed required keys; no invent).
-- Tournament wording - migrateonly re-applies before 381/387 soft-fills.
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || '{
  "list_kind_topup": "Top-up",
  "list_kind_payout": "Payout",
  "list_kind_event_host_fee": "Tournament host fee",
  "list_kind_event_entry_paid": "Tournament entry fee",
  "list_kind_event_entry_earned": "Tournament entry earned"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'wallet_chrome';
