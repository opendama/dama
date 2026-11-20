-- Escrow-grade organizer prize-pool guarantee hardening (hosted events only).
-- Floor pot math is server-side (max(entry nets, guarantee)). Unique ledger refs.
-- Captured flag + hold cycle for reopen re-hold. Chrome for settle/live/reopen paths.

-- ---------------------------------------------------------------------------
-- hosted_events: captured + hold cycle
-- ---------------------------------------------------------------------------
ALTER TABLE hosted_events
  ADD COLUMN IF NOT EXISTS prize_pool_guarantee_captured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prize_pool_guarantee_cycle INT NOT NULL DEFAULT 1
    CHECK (prize_pool_guarantee_cycle >= 1);

-- Heal: if a capture ledger exists for cycle 1, stamp captured and clear held.
UPDATE hosted_events he
SET prize_pool_guarantee_captured = TRUE,
    prize_pool_guarantee_held = FALSE,
    updated_at = NOW()
WHERE he.prize_pool_guarantee_enabled = TRUE
  AND he.prize_pool_guarantee_amount > 0
  AND EXISTS (
    SELECT 1 FROM wallet_ledger wl
    WHERE wl.kind = 'prize_pool_guarantee_capture'
      AND (
        wl.reference = 'hosted_event_prize_guarantee_capture:' || he.id::text
        OR wl.reference = 'hosted_event_prize_guarantee_capture:' || he.id::text || ':1'
      )
  );

-- ---------------------------------------------------------------------------
-- wallet_ledger: unique (reference, kind) when reference is non-empty
-- ---------------------------------------------------------------------------
-- Drop duplicate non-empty (reference, kind) rows keeping the oldest.
DELETE FROM wallet_ledger a
USING wallet_ledger b
WHERE a.ctid < b.ctid
  AND a.reference = b.reference
  AND a.kind = b.kind
  AND length(trim(a.reference)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_reference_kind
  ON wallet_ledger (reference, kind)
  WHERE length(trim(reference)) > 0;

-- ---------------------------------------------------------------------------
-- Feature flag catalog blurb: guaranteed floor (not additive top-up)
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = jsonb_set(
  value,
  '{toggles}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'key' = 'prize_pool_guarantee_enabled'
          THEN elem || jsonb_build_object(
            'description',
            'Allow organizers to post a guaranteed minimum floor held from their wallet at create. Pot is max(entry nets, guarantee). Requires prize pool display.'
          )
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(value->'toggles', '[]'::jsonb)) AS elem
  )
),
updated_at = NOW()
WHERE key = 'feature_flag_catalog';

UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_guarantee_flag_blurb',
  'When on, organizers can post a guaranteed minimum floor held from their wallet at create. Pot is max(entry nets, guarantee). Requires prize pool display.'
),
updated_at = NOW()
WHERE key = 'events_admin_chrome';

-- ---------------------------------------------------------------------------
-- Organizer chrome: floor copy + settle/live/reopen keys
-- ---------------------------------------------------------------------------
UPDATE platform_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object(
  'prize_pool_guarantee_blurb',
  'Optional floor held from your wallet at create. Pot is the greater of entry-fee nets or this floor. Released if you cancel before start. Reopen re-holds from your wallet.',
  'insufficient_prize_guarantee',
  COALESCE(NULLIF(trim(value->>'insufficient_prize_guarantee'), ''), 'Not enough wallet balance to hold the prize guarantee.'),
  'err_prize_guarantee_amount_invalid',
  COALESCE(NULLIF(trim(value->>'err_prize_guarantee_amount_invalid'), ''), 'Enter a valid prize guarantee amount.'),
  'err_prize_guarantee_settle_failed',
  COALESCE(NULLIF(trim(value->>'err_prize_guarantee_settle_failed'), ''), 'Could not hold the prize guarantee. Try again.'),
  'err_guarantee_live_cannot_release',
  COALESCE(NULLIF(trim(value->>'err_guarantee_live_cannot_release'), ''), 'Cannot release a prize guarantee while the cup is live or already captured.'),
  'err_reopen_guarantee_hold_failed',
  COALESCE(NULLIF(trim(value->>'err_reopen_guarantee_hold_failed'), ''), 'Reopen needs the prize guarantee held again. Top up your wallet and retry.')
),
updated_at = NOW()
WHERE key = 'events_organizer_chrome';
