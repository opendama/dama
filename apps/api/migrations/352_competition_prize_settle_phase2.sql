-- Phase 2: competition prize payout ledger + client_enums backfill (idempotent).

UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{wallet_ledger_kinds}',
  (
    SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(value->'wallet_ledger_kinds', '[]'::jsonb)) AS x
      UNION
      SELECT unnest(ARRAY['competition_prize_payout'])
    ) k
  )
),
updated_at = NOW()
WHERE key = 'client_enums';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'list_kind_competition_prize_payout', COALESCE(NULLIF(trim(value->>'list_kind_competition_prize_payout'), ''), 'Competition prize')
),
updated_at = NOW()
WHERE key = 'wallet_chrome';

UPDATE platform_settings
SET value = value || jsonb_build_object(
  'competition_prize_payout_statuses', COALESCE(value->'competition_prize_payout_statuses', '["pending","settled","failed","cancelled"]'::jsonb),
  'competition_prize_payout_pending', COALESCE(NULLIF(trim(value->>'competition_prize_payout_pending'), ''), 'pending'),
  'competition_prize_payout_settled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_settled'), ''), 'settled'),
  'competition_prize_payout_failed', COALESCE(NULLIF(trim(value->>'competition_prize_payout_failed'), ''), 'failed'),
  'competition_prize_payout_cancelled', COALESCE(NULLIF(trim(value->>'competition_prize_payout_cancelled'), ''), 'cancelled'),
  'competition_dispute_window_hours', COALESCE(NULLIF(trim(value->>'competition_dispute_window_hours'), ''), '24')
),
updated_at = NOW()
WHERE key = 'client_enums';

CREATE INDEX IF NOT EXISTS idx_competition_prize_payouts_pending
  ON competition_prize_payouts (status, created_at)
  WHERE status = 'pending';
