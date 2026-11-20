-- Mig 387: Force wallet ledger kinds that still say "Event entry …"
-- (commission / refund / clawback) to Tournament wording.
-- Soft-fill in 381 left non-empty Event strings when host_fee/paid/earned
-- were already Tournament. Idempotent.

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'list_kind_event_host_fee', 'Tournament host fee',
  'list_kind_event_entry_paid', 'Tournament entry fee',
  'list_kind_event_entry_earned', 'Tournament entry earned',
  'list_kind_event_entry_commission', 'Tournament entry commission',
  'list_kind_event_entry_refund', 'Tournament entry refund',
  'list_kind_event_entry_clawback', 'Tournament entry clawback'
),
updated_at = NOW()
WHERE key = 'wallet_chrome'
  AND (
    COALESCE(value->>'list_kind_event_host_fee', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_paid', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_earned', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_commission', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_refund', '') ILIKE 'event %'
    OR COALESCE(value->>'list_kind_event_entry_clawback', '') ILIKE 'event %'
  );
